'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Fixture } from '@/lib/txline/types'
import type { Platform, Selection, SelectionType } from '@/types'
import { calculateCodeEdge, formatEdge } from '@/lib/edge-calculator'
import EdgeBadge from './EdgeBadge'
import SelectionRow from './SelectionRow'

interface CodeBuilderProps {
  prefillMatchId?: string
  prefillTeam?: 'home' | 'away'
}

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'sportybet', label: 'SportyBet' },
  { value: 'bet9ja', label: 'bet9ja' },
  { value: '1xbet', label: '1xBet' },
  { value: '247bet', label: '247Bet' },
  { value: 'other', label: 'Other' },
]

const SELECTION_TYPES: { value: SelectionType; label: string }[] = [
  { value: 'home_win', label: 'Home to win' },
  { value: 'draw', label: 'Draw' },
  { value: 'away_win', label: 'Away to win' },
]

function isSelectable(phase: Fixture['phase']): boolean {
  return phase !== 'C' && phase !== 'F' && phase !== 'FET' && phase !== 'FPE'
}

export default function CodeBuilder({ prefillMatchId, prefillTeam }: CodeBuilderProps) {
  const router = useRouter()
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [platform, setPlatform] = useState<Platform>('sportybet')
  const [platformCode, setPlatformCode] = useState('')
  const [selections, setSelections] = useState<Selection[]>([])

  const [matchId, setMatchId] = useState(prefillMatchId || '')
  const [selectionType, setSelectionType] = useState<SelectionType>(prefillTeam === 'away' ? 'away_win' : 'home_win')
  const [oddsInput, setOddsInput] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [addBusy, setAddBusy] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/fixtures')
      .then((r) => r.json())
      .then((d) => {
        const allFixtures = (d.fixtures || []) as Fixture[]
        const selectable = allFixtures.filter((fixture) => isSelectable(fixture.phase))
        const prefilled = prefillMatchId
          ? allFixtures.find((fixture) => fixture.matchId === prefillMatchId)
          : undefined
        setFixtures(
          prefilled && !selectable.some((fixture) => fixture.matchId === prefilled.matchId)
            ? [prefilled, ...selectable]
            : selectable
        )
      })
      .catch(() => setFixtures([]))
  }, [prefillMatchId])

  const activeMatch = fixtures.find((f) => f.matchId === matchId)

  const handleAddSelection = async () => {
    setAddError(null)
    const odds = Number(oddsInput)
    if (!matchId || !activeMatch) {
      setAddError('Pick a match first')
      return
    }
    if (!odds || odds <= 1.0) {
      setAddError('Enter decimal odds greater than 1.0')
      return
    }
    if (selections.length >= 10) {
      setAddError('A code can hold at most 10 selections')
      return
    }

    setAddBusy(true)
    try {
      const res = await fetch('/api/edge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, selectionType, platformOdds: odds }),
      })
      const data = await res.json()
      if (!res.ok || !data.available) {
        throw new Error(data.reason || data.error || 'TxLINE Match Winner odds are not open yet')
      }

      const platformProb = 1 / odds
      const newSelection: Selection = {
        matchId,
        homeTeam: activeMatch.homeTeam,
        awayTeam: activeMatch.awayTeam,
        selectionType,
        platformOdds: odds,
        txlineProb: data.txlineProb,
        platformProb,
        edge: data.edge,
        edgeVerified: true,
        fromShock: Boolean(prefillMatchId && matchId === prefillMatchId),
        status: 'pending',
      }
      setSelections((prev) => [...prev, newSelection])
      setOddsInput('')
    } catch (err) {
      // Preserve the specific reason (e.g. "No live odds for this match
      // yet.") instead of masking it behind a generic network-error message
      // — a closed market and a dead connection are different problems and
      // look identical to the user if this always says the same thing.
      setAddError(err instanceof Error ? err.message : 'Could not reach the edge service — try again')
    } finally {
      setAddBusy(false)
    }
  }

  const overallEdge = calculateCodeEdge(selections)

  const handleShare = async () => {
    if (selections.length === 0) {
      setSaveError('Add at least one selection first')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, platformCode: platformCode || undefined, selections }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save code')

      const lumiereCode = data.code.lumiere_code as string
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const link = `${appUrl}/code/${lumiereCode}`

      const lines = selections.map((s) => {
        const icon = s.selectionType.includes('win') || s.selectionType === 'draw' ? '🏆' : s.selectionType.startsWith('btts') ? '🥅' : '⚽'
        const label =
          s.selectionType === 'home_win' ? `${s.homeTeam} to win`
          : s.selectionType === 'away_win' ? `${s.awayTeam} to win`
          : s.selectionType === 'draw' ? 'Draw'
          : s.selectionType === 'over_2.5' ? `Over 2.5 goals — ${s.homeTeam} vs ${s.awayTeam}`
          : s.selectionType === 'under_2.5' ? `Under 2.5 goals — ${s.homeTeam} vs ${s.awayTeam}`
          : s.selectionType === 'btts_yes' ? `Both teams to score — ${s.homeTeam} vs ${s.awayTeam}`
          : `Both teams not to score — ${s.homeTeam} vs ${s.awayTeam}`
        return `${icon} ${label}`
      })

      const message = [
        `🔍 @${data.code.creator_username} shared a code on LUMIÈRE`,
        '',
        `Selections: ${selections.length} game${selections.length === 1 ? '' : 's'}`,
        `Platform: ${PLATFORMS.find((p) => p.value === platform)?.label}`,
        platformCode ? `Booking code: ${platformCode}` : null,
        `Market edge: ${formatEdge(overallEdge)}`,
        '',
        ...lines,
        '',
        `Track live → ${link}`,
      ]
        .filter((l) => l !== null)
        .join('\n')

      window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`, '_blank')
      void fetch(`/api/codes/${encodeURIComponent(lumiereCode)}`, { method: 'POST' }).catch(() => undefined)
      router.push(`/code/${lumiereCode}`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Platform for the whole code */}
      <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#f5c518]">Platform</h3>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPlatform(p.value)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                platform === p.value ? 'bg-[#f5c518] text-black' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Booking code (optional)</label>
          <input
            type="text"
            value={platformCode}
            onChange={(e) => setPlatformCode(e.target.value)}
            placeholder="e.g. XYZ123"
            className="w-full bg-[#0a0a0a] border border-white/10 text-white text-base font-mono rounded-xl px-4 py-3 focus:outline-none focus:border-[#f5c518]"
          />
          <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
            Get this from the booking/share option on your SportyBet, bet9ja, 1xBet or 247Bet slip.
            It is optional; for testing, leave it blank or enter TEST123.
          </p>
        </div>
      </section>

      {/* Add a selection */}
      <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#f5c518]">Add a selection ({selections.length}/10)</h3>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Match</label>
          <select
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-white/10 text-white text-base rounded-xl px-4 py-3 focus:outline-none focus:border-[#f5c518]"
          >
            <option value="">Select a match</option>
            {fixtures.map((f) => (
              <option key={f.matchId} value={f.matchId}>
                {f.homeTeam} vs {f.awayTeam}
              </option>
            ))}
          </select>
          <p className='mt-2 text-[11px] text-gray-500'>
            Match Winner is the verified TxLINE market available today. Goal and BTTS markets stay hidden until their live schema is verified.
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Selection type</label>
          <select
            value={selectionType}
            onChange={(e) => setSelectionType(e.target.value as SelectionType)}
            className="w-full bg-[#0a0a0a] border border-white/10 text-white text-base rounded-xl px-4 py-3 focus:outline-none focus:border-[#f5c518]"
          >
            {SELECTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Your platform&apos;s odds</label>
          <input
            type="number"
            step="0.01"
            min="1.01"
            value={oddsInput}
            onChange={(e) => setOddsInput(e.target.value)}
            placeholder="2.10"
            className="w-full bg-[#0a0a0a] border border-white/10 text-white text-base font-mono rounded-xl px-4 py-3 focus:outline-none focus:border-[#f5c518]"
          />
        </div>

        {addError && <p className="text-xs text-rose-400">{addError}</p>}

        <button
          onClick={handleAddSelection}
          disabled={addBusy}
          className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-widest transition-all"
        >
          {addBusy ? 'Checking market...' : '+ Add selection'}
        </button>
      </section>

      {/* Current selections */}
      {selections.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#f5c518]">Selections</h3>
            <EdgeBadge edge={overallEdge} />
          </div>
          {selections.map((s, idx) => (
            <SelectionRow key={idx} selection={s} onRemove={() => setSelections((prev) => prev.filter((_, i) => i !== idx))} />
          ))}
        </section>
      )}

      {saveError && <p className="text-xs text-rose-400 text-center">{saveError}</p>}

      <button
        onClick={handleShare}
        disabled={saving || selections.length === 0}
        className="w-full py-4 rounded-full bg-[#f5c518] hover:bg-[#e2b514] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-sm uppercase tracking-widest transition-all"
      >
        {saving ? 'Saving...' : 'Share to Telegram'}
      </button>
    </div>
  )
}

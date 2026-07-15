'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { Fixture, GamePhase } from '@/lib/txline/types'
import TeamFlag from './TeamFlag'

function isCompleted(phase: GamePhase): boolean {
  return phase === 'F' || phase === 'FET' || phase === 'FPE' || phase === 'C'
}

function isLive(phase: GamePhase): boolean {
  return phase !== 'NS' && phase !== 'P' && !isCompleted(phase)
}

interface MatchPickerProps {
  fixtures: Fixture[]
  selectedMatchId: string | null
  onSelect: (fixture: Fixture) => void
}

export default function MatchPicker({ fixtures, selectedMatchId, onSelect }: MatchPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const selected = fixtures.find((f) => f.matchId === selectedMatchId)
  if (fixtures.length === 0 || !selected) return null

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider text-gray-300 hover:text-white border-l border-white/10 transition-colors max-w-[210px]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex -space-x-1.5 shrink-0">
          <TeamFlag team={selected.homeTeam} size={18} />
          <TeamFlag team={selected.awayTeam} size={18} />
        </span>
        <span className="truncate">
          {selected.homeTeam} v {selected.awayTeam}
        </span>
        <svg className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[60vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0f0f0f]/95 backdrop-blur-md shadow-2xl p-2 z-50" role="listbox">
          {fixtures.map((f) => {
            const live = isLive(f.phase)
            const completed = isCompleted(f.phase)
            const active = f.matchId === selectedMatchId
            const when = new Date(f.kickoff).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
            return (
              <button
                key={f.matchId}
                onClick={() => {
                  onSelect(f)
                  setOpen(false)
                }}
                role="option"
                aria-selected={active}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                  active ? 'bg-[#f5c518]/10 border border-[#f5c518]/30' : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <span className="flex -space-x-1.5 shrink-0">
                  <TeamFlag team={f.homeTeam} size={22} />
                  <TeamFlag team={f.awayTeam} size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-white font-display truncate">
                    {f.homeTeam} v {f.awayTeam}
                  </span>
                  <span className="block text-[10px] font-mono text-gray-500 mt-0.5" suppressHydrationWarning>
                    {when}
                  </span>
                </span>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase tracking-wider ${
                    live
                      ? 'bg-rose-500/15 text-rose-400 animate-pulse'
                      : completed
                        ? 'bg-white/5 text-gray-500'
                        : 'bg-[#f5c518]/15 text-[#f5c518]'
                  }`}
                >
                  {live ? 'Live' : completed ? 'Replay' : 'Soon'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// src/app/match/[matchId]/page.tsx
'use client'

import React, { use, useEffect, useState } from 'react'
import type { Fixture, MatchEvent, MatchState, OddsEvent } from '@/lib/txline/types'
import type { OddsShock } from '@/types'
import OddsTimeline from '@/components/OddsTimeline'
import ShockHistory from '@/components/ShockHistory'
import ProbabilityBar from '@/components/ProbabilityBar'
import ShockAlert from '@/components/ShockAlert'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ matchId: string }>
}

export default function WatchPage({ params }: PageProps) {
  const { matchId } = use(params)
  
  const [fixture, setFixture] = useState<Fixture | null>(null)
  const [updates, setUpdates] = useState<OddsEvent[]>([])
  const [shocks, setShocks] = useState<OddsShock[]>([])
  const [activeShock, setActiveShock] = useState<OddsShock | null>(null)
  const [scoresState, setScoresState] = useState<MatchState | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 1. Fetch Fixture details
  useEffect(() => {
    async function loadFixture() {
      try {
        const res = await fetch('/api/fixtures')
        if (!res.ok) throw new Error('Failed to retrieve fixture lists')
        const data = await res.json()
        const match = (data.fixtures as Fixture[]).find(f => f.matchId === matchId)
        if (!match) throw new Error(`Fixture not found for ID: ${matchId}`)
        setFixture(match)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    loadFixture()
  }, [matchId])

  // 2. SSE Relay Stream Connection
  useEffect(() => {
    if (!fixture) return

    const scoresSource = new EventSource(`/api/scores-relay?matchId=${matchId}`)
    const oddsSource = new EventSource(`/api/odds-relay?matchId=${matchId}`)

    // Handle scores updates
    scoresSource.addEventListener('event', (e) => {
      try {
        const data = JSON.parse(e.data) as { event: MatchEvent; state: MatchState }
        setScoresState(data.state)
        
        // Update scores inside fixture object to reflect on scoreboard
        setFixture(prev => {
          if (!prev) return null
          return {
            ...prev,
            homeScore: data.state.homeScore,
            awayScore: data.state.awayScore,
            phase: data.state.phase,
          }
        })
      } catch (err) {
        console.error('Failed to parse live score event:', err)
      }
    })

    // Handle odds updates
    oddsSource.addEventListener('odds', (e) => {
      try {
        const data = JSON.parse(e.data) as OddsEvent
        setUpdates(prev => [...prev, data])
      } catch (err) {
        console.error('Failed to parse odds update:', err)
      }
    })

    // Handle odds shocks — the relay already attaches the AI explanation
    // server-side before emitting, so no client-side fetch is needed here.
    oddsSource.addEventListener('shock', (e) => {
      try {
        const shock = JSON.parse(e.data) as OddsShock
        setShocks((prev) => [...prev, shock])
        setActiveShock(shock)
      } catch (err) {
        console.error('Failed to parse shock update:', err)
      }
    })

    return () => {
      scoresSource.close()
      oddsSource.close()
    }
  }, [fixture, matchId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin" />
          <span className="font-display uppercase tracking-wider text-sm">Connecting Live Streams...</span>
        </div>
      </div>
    )
  }

  if (error || !fixture) {
    return (
      <div className="max-w-md mx-auto my-24 p-6 rounded-xl border border-rose-500/20 bg-rose-950/10 text-center space-y-4">
        <p className="text-rose-400 font-semibold">{error || 'Fixture not found.'}</p>
        <Link href="/" className="inline-block text-xs font-bold uppercase bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full transition-colors">
          Return Home
        </Link>
      </div>
    )
  }

  // Get current win probability values (default to equal split if empty)
  const currentOdds = updates[updates.length - 1]
  const homeProb = currentOdds ? currentOdds.homeProb : 0.333
  const drawProb = currentOdds ? currentOdds.drawProb : 0.333
  const awayProb = currentOdds ? currentOdds.awayProb : 0.333

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back to dashboard */}
      <div className="flex justify-between items-center">
        <Link href="/" className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors">
          ← Back to matches
        </Link>
        <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 uppercase tracking-widest animate-pulse">
          🔴 Live Intel Mode
        </span>
      </div>

      {/* Scoreboard banner */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
        {/* Home */}
        <div className="flex-1 text-center md:text-right min-w-0">
          <h2 className="text-xl md:text-2xl font-bold text-white truncate font-display">{fixture.homeTeam}</h2>
        </div>
        {/* Score */}
        <div className="flex flex-col items-center px-6 py-2 rounded-xl bg-white/5 border border-white/5">
          <div className="text-3xl md:text-4xl font-extrabold font-mono tracking-widest text-white">
            {fixture.homeScore ?? 0} - {fixture.awayScore ?? 0}
          </div>
          {scoresState && typeof scoresState.minute === 'number' && (
            <div className="text-xs text-amber-500 font-semibold mt-1">
              {scoresState.minute}' Minute
            </div>
          )}
        </div>
        {/* Away */}
        <div className="flex-1 text-center md:text-left min-w-0">
          <h2 className="text-xl md:text-2xl font-bold text-white truncate font-display">{fixture.awayTeam}</h2>
        </div>
      </div>

      {/* Dynamic 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Column 1: Probability bar chart */}
        <div className="space-y-6 lg:col-span-1">
          <ProbabilityBar
            homeTeam={fixture.homeTeam}
            awayTeam={fixture.awayTeam}
            homeProb={homeProb}
            drawProb={drawProb}
            awayProb={awayProb}
          />
          <div className="glass-panel p-5 rounded-xl border border-white/5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2 font-display">Live Coverage Info</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Betting market chances updates are normalized directly from the mainnet feed. Shock alarms trigger if the odds swing by 15% or more in a rolling 90-second window.
            </p>
          </div>
        </div>

        {/* Column 2: Ambient Odds updates ticker timeline */}
        <div className="lg:col-span-1 h-[600px]">
          <OddsTimeline
            updates={updates}
            shocks={shocks}
            homeTeam={fixture.homeTeam}
            awayTeam={fixture.awayTeam}
          />
        </div>

        {/* Column 3: Shocks Commentator Timeline */}
        <div className="lg:col-span-1 h-[600px]">
          <ShockHistory
            shocks={shocks}
            onSelectShock={(s) => setActiveShock(s)}
          />
        </div>
      </div>

      {/* Full screen Shock Alert Overlay Modal */}
      <ShockAlert
        shock={activeShock}
        onClose={() => setActiveShock(null)}
      />
    </main>
  )
}

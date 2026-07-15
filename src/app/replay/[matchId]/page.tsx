// src/app/replay/[matchId]/page.tsx
'use client'

import React, { use, useEffect, useState } from 'react'
import type { Fixture, MatchEvent, MatchState, OddsEvent } from '@/lib/txline/types'
import type { OddsShock } from '@/types'
import OddsTimeline from '@/components/OddsTimeline'
import ShockHistory from '@/components/ShockHistory'
import ProbabilityBar from '@/components/ProbabilityBar'
import ReplayControls from '@/components/ReplayControls'
import ShockAlert from '@/components/ShockAlert'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ matchId: string }>
}

export default function ReplayPage({ params }: PageProps) {
  const { matchId } = use(params)
  
  const [fixture, setFixture] = useState<Fixture | null>(null)
  const [updates, setUpdates] = useState<OddsEvent[]>([])
  const [shocks, setShocks] = useState<OddsShock[]>([])
  const [activeShock, setActiveShock] = useState<OddsShock | null>(null)
  const [scoresState, setScoresState] = useState<MatchState | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Replay timeline clock state
  const [isPlaying, setIsPlaying] = useState(true)
  const [speed, setSpeed] = useState(5)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [startTime, setStartTime] = useState<number>(0)
  const [endTime, setEndTime] = useState<number>(0)
  const [seekTimestamp, setSeekTimestamp] = useState<number | null>(null)

  // 1. Fetch Fixture details and history parameters
  useEffect(() => {
    async function loadFixture() {
      try {
        const res = await fetch(`/api/history/${matchId}`)
        if (!res.ok) throw new Error('Failed to retrieve historical replay cache details')
        const data = await res.json()
        
        const kickoff = new Date(data.matchDate).getTime()
        const matchFixture: Fixture = {
          matchId: data.matchId,
          homeTeam: data.homeTeam,
          awayTeam: data.awayTeam,
          kickoff,
          phase: 'C',
          homeScore: 0,
          awayScore: 0,
          league: 'World Cup',
          raw: null,
        }
        
        setFixture(matchFixture)
        setStartTime(kickoff)
        setCurrentTime(kickoff)
        // Typical match timeline window: 2 hours (120 minutes)
        setEndTime(kickoff + 120 * 60_000)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    loadFixture()
  }, [matchId])

  // 2. EventSource Replay connection effect
  useEffect(() => {
    if (!fixture || !isPlaying) return

    let url = `/api/replay?matchId=${matchId}&speed=${speed}`
    if (seekTimestamp !== null) {
      url += `&startAt=${seekTimestamp}`
    } else if (currentTime > startTime) {
      url += `&startAt=${currentTime}`
    }

    const source = new EventSource(url)

    source.addEventListener('event', (e) => {
      try {
        const data = JSON.parse(e.data) as { event: MatchEvent; state: MatchState }
        setScoresState(data.state)
        
        setFixture(prev => {
          if (!prev) return null
          return {
            ...prev,
            homeScore: data.state.homeScore,
            awayScore: data.state.awayScore,
          }
        })
        
        if (data.event.timestamp) {
          setCurrentTime(data.event.timestamp)
        }
      } catch (err) {
        console.error('Failed to parse replay event:', err)
      }
    })

    source.addEventListener('odds', (e) => {
      try {
        const data = JSON.parse(e.data) as OddsEvent
        setUpdates(prev => [...prev, data])
        setCurrentTime(data.timestamp)
      } catch (err) {
        console.error('Failed to parse replay odds update:', err)
      }
    })

    source.addEventListener('shock', (e) => {
      try {
        const shock = JSON.parse(e.data) as OddsShock
        setShocks((prev) => [...prev, shock])
        setActiveShock(shock)
      } catch (err) {
        console.error('Failed to parse replay shock:', err)
      }
    })

    source.addEventListener('error', () => {
      if (source.readyState === EventSource.CLOSED) {
        setIsPlaying(false)
      }
    })

    return () => {
      source.close()
    }
  }, [fixture !== null, isPlaying, speed, seekTimestamp])

  const handleSeek = (timestamp: number) => {
    // Reset lists for new timeline stream starting at timestamp
    setUpdates([])
    setShocks([])
    setCurrentTime(timestamp)
    setSeekTimestamp(timestamp)
    setIsPlaying(true) // Auto-resume on seek action
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[#f5c518]/25 border-t-[#f5c518] animate-spin" />
          <span className="font-display uppercase tracking-wider text-sm">Loading the replay — real recorded market data...</span>
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
      {/* Navigation header */}
      <div className="flex justify-between items-center">
        <Link href="/" className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors">
          ← Back to matches
        </Link>
        <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#f5c518]/15 text-[#f5c518] uppercase tracking-widest">
          Replay — recorded market data
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

      {/* Replay dashboard control bar */}
      <ReplayControls
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(prev => !prev)}
        speed={speed}
        onChangeSpeed={(s) => {
          setSpeed(s)
          setSeekTimestamp(null) // Clear manual seek parameter on speed shift
        }}
        currentTime={currentTime}
        startTime={startTime}
        endTime={endTime}
        onSeek={handleSeek}
      />

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
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#f5c518] mb-2 font-display">About this replay</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Nothing here is invented — this is the match&apos;s real recorded market data, played back chronologically
              at the chosen speed. Use the slider to seek anywhere in the timeline; shocks fire exactly where they fired live.
            </p>
          </div>
        </div>

        {/* Column 2: Ambient Odds updates ticker timeline */}
        <div className="lg:col-span-1 h-[550px]">
          <OddsTimeline
            updates={updates}
            shocks={shocks}
            homeTeam={fixture.homeTeam}
            awayTeam={fixture.awayTeam}
          />
        </div>

        {/* Column 3: Shocks Commentator Timeline */}
        <div className="lg:col-span-1 h-[550px]">
          <ShockHistory
            shocks={shocks}
            onSelectShock={(s) => setActiveShock(s)}
          />
        </div>
      </div>

      {/* Shock Alert Overlay Modal */}
      <ShockAlert
        shock={activeShock}
        onClose={() => setActiveShock(null)}
      />
    </main>
  )
}

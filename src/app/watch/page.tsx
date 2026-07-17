// src/app/watch/page.tsx
'use client'

import React, { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Fixture, MatchEvent, MatchState, OddsEvent } from '@/lib/txline/types'
import type { OddsShock } from '@/types'
import AmbientOverlay from '@/components/AmbientOverlay'
import Link from 'next/link'
import SwipeFeed from '@/components/SwipeFeed'
import MatchPicker from '@/components/MatchPicker'
import { useAuthUser } from '@/lib/use-auth'
import { isPrimaryMarket } from '@/lib/primary-market'

type AppMode = 'following' | 'watching'
type FeedStatus = 'connecting' | 'live' | 'reconnecting' | 'stale' | 'complete'

const STANDARD_REPLAY_SPEED = 1
const DEMO_REPLAY_SPEED = 5
const LAST_MATCH_STORAGE_KEY = 'lumiere_last_match_id'

function oddsEventKey(event: OddsEvent): string {
  const messageId = (event.raw as { MessageId?: unknown } | null)?.MessageId
  if (typeof messageId === 'string') return messageId
  return `${event.timestamp}|${event.market}|${event.homeProb}|${event.drawProb}|${event.awayProb}`
}

function isCompletedPhase(phase: Fixture['phase']): boolean {
  return phase === 'F' || phase === 'FET' || phase === 'FPE' || phase === 'C'
}

function isLivePhase(phase: Fixture['phase']): boolean {
  return phase !== 'NS' && phase !== 'P' && !isCompletedPhase(phase)
}

function WatchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDemo = searchParams.get('demo') === 'true'
  const demoMatchId = process.env.NEXT_PUBLIC_DEMO_MATCH_ID || '18202701'

  // Demo mode must work with zero login (checklist 15) — every other path requires auth.
  const { user, loading: authLoading } = useAuthUser()
  useEffect(() => {
    if (!isDemo && !authLoading && !user) router.replace('/auth')
  }, [isDemo, authLoading, user, router])

  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [activeFixture, setActiveFixture] = useState<Fixture | null>(null)

  const [updates, setUpdates] = useState<OddsEvent[]>([])
  const [updateCount, setUpdateCount] = useState(0)
  const [shocks, setShocks] = useState<OddsShock[]>([])
  const [activeShock, setActiveShock] = useState<OddsShock | null>(null)
  const [scoresState, setScoresState] = useState<MatchState | null>(null)
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([])
  const seenOddsIds = useRef(new Set<string>())

  const [mode, setMode] = useState<AppMode>('following')

  useEffect(() => {
    const savedMode = localStorage.getItem('lumiere_mode')
    if (savedMode === 'following' || savedMode === 'watching') {
      setMode(savedMode)
    }
  }, [])

  const handleModeChange = (newMode: AppMode) => {
    setMode(newMode)
    localStorage.setItem('lumiere_mode', newMode)
  }

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [feedStatus, setFeedStatus] = useState<FeedStatus>('connecting')
  const [lastFeedReceivedAt, setLastFeedReceivedAt] = useState<number | null>(null)
  const [, setHealthClock] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setHealthClock((value) => value + 1)
      if (feedStatus !== 'complete' && lastFeedReceivedAt && Date.now() - lastFeedReceivedAt > 45_000) setFeedStatus('stale')
    }, 1_000)
    return () => clearInterval(timer)
  }, [feedStatus, lastFeedReceivedAt])

  // 1. Load Fixtures List or Demo Metadata
  useEffect(() => {
    async function loadData() {
      try {
        if (isDemo) {
          const res = await fetch(`/api/history/${demoMatchId}`)
          if (!res.ok) throw new Error('Failed to retrieve demo match metadata')
          const data = await res.json()

          const demoFixture: Fixture = {
            matchId: data.matchId,
            homeTeam: data.homeTeam,
            awayTeam: data.awayTeam,
            kickoff: new Date(data.matchDate).getTime(),
            phase: 'C',
            homeScore: 0,
            awayScore: 0,
            league: 'World Cup',
            raw: null,
          }

          setActiveFixture(demoFixture)
          setSelectedMatchId(demoMatchId)
        } else {
          const res = await fetch('/api/fixtures')
          if (!res.ok) throw new Error('Failed to retrieve active fixtures')
          const data = await res.json()
          // Default pick: a live match first, else the next upcoming kickoff,
          // else the most recently finished match (which auto-plays as a replay).
          const rank = (f: Fixture) => (isLivePhase(f.phase) ? 0 : f.phase === 'NS' || f.phase === 'P' ? 1 : 2)
          const list = (data.fixtures as Fixture[]).sort(
            (a, b) => rank(a) - rank(b) || (rank(a) === 2 ? b.kickoff - a.kickoff : a.kickoff - b.kickoff)
          )
          setFixtures(list)

          if (list.length > 0) {
            const requestedMatchId = new URL(window.location.href).searchParams.get('match')
            const savedMatchId = localStorage.getItem(LAST_MATCH_STORAGE_KEY)
            const restoredFixture =
              list.find((fixture) => fixture.matchId === requestedMatchId) ??
              list.find((fixture) => fixture.matchId === savedMatchId) ??
              list[0]

            setActiveFixture(restoredFixture)
            setSelectedMatchId(restoredFixture.matchId)
            localStorage.setItem(LAST_MATCH_STORAGE_KEY, restoredFixture.matchId)

            const url = new URL(window.location.href)
            if (url.searchParams.get('match') !== restoredFixture.matchId) {
              url.searchParams.set('match', restoredFixture.matchId)
              window.history.replaceState(window.history.state, '', url)
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [isDemo, demoMatchId])

  // 2. SSE Stream Listener Effect
  useEffect(() => {
    if (!selectedMatchId || !activeFixture) return

    setUpdates([])
    setUpdateCount(0)
    setShocks([])
    setActiveShock(null)
    setScoresState(null)
    setMatchEvents([])
    setStreamError(null)
    setFeedStatus('connecting')
    setLastFeedReceivedAt(null)
    seenOddsIds.current.clear()

    let scoresSource: EventSource | null = null
    let oddsSource: EventSource | null = null

    const handleMatchEvent = (raw: string, applyScore: boolean, applyFixturePhase: boolean) => {
      const data = JSON.parse(raw) as { event: MatchEvent; state: MatchState }
      setStreamError(null)
      setFeedStatus('live')
      setLastFeedReceivedAt(Date.now())
      setScoresState(data.state)
      if (applyScore) {
        setActiveFixture((prev) =>
          prev
            ? {
                ...prev,
                homeScore: data.state.homeScore,
                awayScore: data.state.awayScore,
                phase: applyFixturePhase ? data.state.phase : prev.phase,
              }
            : null
        )
      }
      if (data.event) {
        setMatchEvents((prev) => {
          const exists = prev.some(
            (item) =>
              (item.timestamp === data.event.timestamp && item.type === data.event.type) ||
              (item.data?.seq !== undefined && item.data?.seq === data.event.data?.seq)
          )
          if (exists) return prev
          return [...prev, data.event]
        })
      }
    }

    const handleOdds = (raw: string) => {
      const update = JSON.parse(raw) as OddsEvent
      if (!isPrimaryMarket(update)) return
      const key = oddsEventKey(update)
      if (seenOddsIds.current.has(key)) return
      seenOddsIds.current.add(key)
      setStreamError(null)
      setFeedStatus('live')
      setLastFeedReceivedAt(Date.now())
      setUpdateCount((count) => count + 1)
      setUpdates((prev) => [...prev.slice(-499), update])
    }

    const handleMatchState = (raw: string) => {
      const state = JSON.parse(raw) as MatchState
      setStreamError(null)
      setFeedStatus('live')
      setLastFeedReceivedAt(Date.now())
      setScoresState(state)
      setActiveFixture((prev) =>
        prev
          ? {
              ...prev,
              homeScore: state.homeScore,
              awayScore: state.awayScore,
              phase: state.phase,
            }
          : null
      )
    }

    const handleShock = (raw: string) => {
      // The relay already attaches the AI explanation server-side before
      // emitting — no client-side fetch or fallback needed here.
      const shock = JSON.parse(raw) as OddsShock
      setFeedStatus('live')
      setLastFeedReceivedAt(Date.now())
      setShocks((prev) =>
        prev.some((item) => item.firedAt === shock.firedAt && item.affectedTeam === shock.affectedTeam)
          ? prev
          : [...prev, shock]
      )
      setActiveShock(shock)
    }

    const handleStreamError = (raw: string) => {
      try {
        const data = JSON.parse(raw) as { message?: string }
        setStreamError(data.message || 'The match feed reported an error and is reconnecting.')
      } catch {
        setStreamError('The match feed reported an error and is reconnecting.')
      }
      setFeedStatus('reconnecting')
    }

    const handleHeartbeat = () => {
      setFeedStatus('live')
      setLastFeedReceivedAt(Date.now())
    }

    const handleNativeError = () => {
      setFeedStatus('reconnecting')
      setStreamError('The TxLINE feed connection is reconnecting.')
    }

    // A finished match has no live stream to listen to — auto-play its replay
    // (the real recorded data) instead of sitting on a feed that never speaks.
    const replayMode = isDemo || isCompletedPhase(activeFixture.phase)

    if (replayMode) {
      const replaySpeed = isDemo ? DEMO_REPLAY_SPEED : STANDARD_REPLAY_SPEED
      oddsSource = new EventSource(`/api/replay?matchId=${selectedMatchId}&speed=${replaySpeed}`)
      oddsSource.onopen = () => setFeedStatus('live')
      oddsSource.addEventListener('heartbeat', handleHeartbeat)
      oddsSource.addEventListener('event', (e) => {
        try {
          handleMatchEvent(e.data, true, false)
        } catch (err) {
          console.error('Failed to parse replay event:', err)
        }
      })
      oddsSource.addEventListener('odds', (e) => {
        try {
          handleOdds(e.data)
        } catch (err) {
          console.error('Failed to parse replay odds:', err)
        }
      })
      oddsSource.addEventListener('shock', (e) => {
        try {
          handleShock(e.data)
        } catch (err) {
          console.error('Failed to parse replay shock:', err)
        }
      })
      oddsSource.addEventListener('replay-error', (e) => handleStreamError(e.data))
      oddsSource.addEventListener('complete', () => {
        setFeedStatus('complete')
        oddsSource?.close()
      })
      oddsSource.onerror = handleNativeError
    } else {
      scoresSource = new EventSource(`/api/scores-relay?matchId=${selectedMatchId}`)
      oddsSource = new EventSource(`/api/odds-relay?matchId=${selectedMatchId}`)
      scoresSource.onopen = () => setFeedStatus('live')
      oddsSource.onopen = () => setFeedStatus('live')
      scoresSource.addEventListener('heartbeat', handleHeartbeat)
      oddsSource.addEventListener('heartbeat', handleHeartbeat)

      scoresSource.addEventListener('state', (e) => {
        try {
          handleMatchState(e.data)
        } catch (err) {
          console.error('Failed to parse live score state:', err)
        }
      })
      scoresSource.addEventListener('event', (e) => {
        try {
          handleMatchEvent(e.data, true, true)
        } catch (err) {
          console.error('Failed to parse live scores:', err)
        }
      })
      oddsSource.addEventListener('odds', (e) => {
        try {
          handleOdds(e.data)
        } catch (err) {
          console.error('Failed to parse live odds:', err)
        }
      })
      oddsSource.addEventListener('shock', (e) => {
        try {
          handleShock(e.data)
        } catch (err) {
          console.error('Failed to parse live shock:', err)
        }
      })
      scoresSource.addEventListener('error', (e) => {
        if (e instanceof MessageEvent) handleStreamError(e.data)
      })
      oddsSource.addEventListener('error', (e) => {
        if (e instanceof MessageEvent) handleStreamError(e.data)
      })
      scoresSource.onerror = handleNativeError
      oddsSource.onerror = handleNativeError
    }

    return () => {
      scoresSource?.close()
      oddsSource?.close()
    }
  }, [selectedMatchId, activeFixture !== null, isDemo])

  const handleSelectMatch = (fixture: Fixture) => {
    setActiveFixture(fixture)
    setSelectedMatchId(fixture.matchId)
    localStorage.setItem(LAST_MATCH_STORAGE_KEY, fixture.matchId)
    const url = new URL(window.location.href)
    url.searchParams.set('match', fixture.matchId)
    window.history.replaceState(window.history.state, '', url)
  }

  if (loading || (!isDemo && (authLoading || !user))) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[#f5c518]/25 border-t-[#f5c518] animate-spin" />
          <span className="font-display uppercase tracking-wider text-sm">
            {isDemo ? 'Loading the replay — real recorded market data...' : 'Connecting Live Feed...'}
          </span>
        </div>
      </div>
    )
  }

  if (error || !activeFixture) {
    return (
      <div className="max-w-md mx-auto my-24 p-6 rounded-xl border border-rose-500/20 bg-rose-950/10 text-center space-y-4">
        <p className="text-rose-400 font-semibold">{error || 'No active matches found.'}</p>
        <Link href="/" className="inline-block text-xs font-bold uppercase bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full transition-colors">
          Return Home
        </Link>
      </div>
    )
  }

  const currentOdds = updates[updates.length - 1]
  const homeProb = currentOdds ? currentOdds.homeProb : 0.333
  const drawProb = currentOdds ? currentOdds.drawProb : 0.333
  const awayProb = currentOdds ? currentOdds.awayProb : 0.333

  return (
    <div className={`relative ${mode === 'following' ? 'h-screen w-screen bg-black overflow-hidden' : 'min-h-screen bg-[#080808] pb-16'}`}>
      {/* Universal Mode Toggle Bar */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gray-950/80 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-full shadow-2xl">
        <button
          onClick={() => handleModeChange('following')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
            mode === 'following' ? 'bg-[#f5c518] text-black shadow-md' : 'text-gray-400 hover:text-white'
          }`}
        >
          Following
        </button>
        <button
          onClick={() => handleModeChange('watching')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
            mode === 'watching' ? 'bg-[#f5c518] text-black shadow-md' : 'text-gray-400 hover:text-white'
          }`}
        >
          Watching
        </button>
        {!isDemo && fixtures.length > 1 && (
          <MatchPicker fixtures={fixtures} selectedMatchId={selectedMatchId} onSelect={handleSelectMatch} />
        )}
        <Link
          href={user ? '/profile' : '/auth'}
          className="pl-3 py-1.5 border-l border-white/10 text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-[#f5c518] transition-colors"
        >
          {user ? 'Profile' : 'Sign in'}
        </Link>
        <Link
          href="/guide"
          className="px-1 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-[#f5c518] transition-colors"
        >
          Guide
        </Link>
      </div>

      {streamError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 max-w-md rounded-full border border-rose-500/30 bg-rose-950/90 px-4 py-2 text-center text-[11px] text-rose-200 shadow-xl">
          {streamError}
        </div>
      )}

      {mode === 'following' ? (
        <SwipeFeed
          shocks={shocks}
          matchEvents={matchEvents}
          activeFixture={activeFixture}
          scoresState={scoresState}
          latestOdds={currentOdds ?? null}
          updateCount={updateCount}
          isDemo={isDemo}
          feedStatus={feedStatus}
          lastFeedAgeSeconds={lastFeedReceivedAt ? Math.max(0, Math.floor((Date.now() - lastFeedReceivedAt) / 1000)) : null}
        />
      ) : (
        <AmbientOverlay
          activeFixture={activeFixture}
          scoresState={scoresState}
          homeProb={homeProb}
          drawProb={drawProb}
          awayProb={awayProb}
          hasOdds={!!currentOdds}
          recentUpdates={updates.slice(-5)}
          updateCount={updateCount}
          latestOdds={currentOdds ?? null}
          isDemo={isDemo}
          feedStatus={feedStatus}
          lastFeedAgeSeconds={lastFeedReceivedAt ? Math.max(0, Math.floor((Date.now() - lastFeedReceivedAt) / 1000)) : null}
          activeShock={activeShock}
          onDismissShock={() => setActiveShock(null)}
        />
      )}
    </div>
  )
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-400">
          <span className="font-display uppercase tracking-widest text-xs">Loading Watch Panel...</span>
        </div>
      }
    >
      <WatchContent />
    </Suspense>
  )
}

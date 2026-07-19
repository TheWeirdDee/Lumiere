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

  // Replay/demo transport controls — pause freezes the display by closing the
  // connection without touching accumulated state; resume and seek both
  // reopen it via the same startAt resume mechanism already used for
  // cross-page checkpoint resume. Live matches never show these controls.
  const [isPaused, setIsPaused] = useState(false)
  const [virtualNow, setVirtualNow] = useState<number | null>(null)
  const seekTargetRef = useRef<number | null>(null)
  const [seekNonce, setSeekNonce] = useState(0)
  const [sliderMinute, setSliderMinute] = useState<number | null>(null)

  const requestSeek = (targetTs: number) => {
    seekTargetRef.current = targetTs
    setIsPaused(false)
    setSliderMinute(null)
    setSeekNonce((n) => n + 1)
  }

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
    // Pause: skip the whole connect cycle. The cleanup below (from the
    // previous, still-playing render) already closed the connection and
    // flushed a checkpoint, so nothing here needs to reset or reconnect —
    // whatever is already on screen simply stays exactly as it is.
    if (isPaused) return

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

    // A finished match has no live stream to listen to — auto-play its replay
    // (the real recorded data) instead of sitting on a feed that never speaks.
    const replayMode = isDemo || isCompletedPhase(activeFixture.phase)

    // Replay resume: navigating to /profile or /guide unmounts this page and
    // would restart the replay from kickoff. Persist position + accumulated
    // feed state per match in sessionStorage and resume via the replay API's
    // startAt parameter. Live streams are untouched.
    const checkpointKey = `lumiere_replay_state_${selectedMatchId}`
    let ckptEvents: MatchEvent[] = []
    let ckptShocks: OddsShock[] = []
    let ckptScores: MatchState | null = null
    let ckptUpdates: OddsEvent[] = []
    let ckptCount = 0
    let ckptAt = 0
    let lastCkptWrite = 0

    let resumeAt: number | undefined
    // Demo/recording convenience: an explicit ?startAt=<unixMs> in the URL
    // jumps a fresh replay straight to that point instead of kickoff. This is
    // the same startAt the engine already accepts for cross-page resume —
    // just exposed directly, so a specific moment (e.g. a marquee shock late
    // in a match) doesn't require waiting through the whole match in real time.
    // Works for any replay (?demo=true or an auto-replayed completed match).
    const requestedStartAt = Number(new URLSearchParams(window.location.search).get('startAt'))
    if (replayMode && seekTargetRef.current !== null) {
      // Highest priority: an explicit seek from the scrubber. Consumed once.
      resumeAt = seekTargetRef.current
      setVirtualNow(resumeAt)
      seekTargetRef.current = null
      try {
        sessionStorage.removeItem(checkpointKey)
      } catch {
        // Ignore storage errors.
      }
    } else if (replayMode && Number.isFinite(requestedStartAt) && requestedStartAt > 0) {
      resumeAt = requestedStartAt
      setVirtualNow(resumeAt)
      try {
        sessionStorage.removeItem(checkpointKey)
      } catch {
        // Ignore storage errors.
      }
    } else if (replayMode) {
      try {
        const raw = sessionStorage.getItem(checkpointKey)
        if (raw) {
          const saved = JSON.parse(raw) as {
            at: number
            scoresState: MatchState | null
            matchEvents: MatchEvent[]
            shocks: OddsShock[]
            updates: OddsEvent[]
            updateCount: number
          }
          if (typeof saved.at === 'number' && saved.at > 0) {
            resumeAt = saved.at + 1
            ckptAt = saved.at
            setVirtualNow(ckptAt)
            ckptEvents = saved.matchEvents ?? []
            ckptShocks = saved.shocks ?? []
            ckptScores = saved.scoresState ?? null
            ckptUpdates = saved.updates ?? []
            ckptCount = saved.updateCount ?? 0
            setMatchEvents(ckptEvents)
            setShocks(ckptShocks)
            setScoresState(ckptScores)
            setUpdates(ckptUpdates)
            setUpdateCount(ckptCount)
            const restoredScores = ckptScores
            if (restoredScores) {
              setActiveFixture((prev) =>
                prev ? { ...prev, homeScore: restoredScores.homeScore, awayScore: restoredScores.awayScore } : prev
              )
            }
          }
        }
      } catch {
        sessionStorage.removeItem(checkpointKey)
      }
    }

    const writeCheckpoint = (at: number, force = false) => {
      if (!replayMode || at <= 0) return
      ckptAt = Math.max(ckptAt, at)
      setVirtualNow(ckptAt) // drives the scrubber's live position, independent of the throttled write below
      const now = Date.now()
      if (!force && now - lastCkptWrite < 3_000) return
      lastCkptWrite = now
      try {
        sessionStorage.setItem(
          checkpointKey,
          JSON.stringify({
            at: ckptAt,
            scoresState: ckptScores,
            matchEvents: ckptEvents,
            shocks: ckptShocks,
            updates: ckptUpdates.slice(-5),
            updateCount: ckptCount,
          })
        )
      } catch {
        // sessionStorage full or unavailable — resume stays best-effort.
      }
    }

    const handleMatchEvent = (raw: string, applyScore: boolean, applyFixturePhase: boolean) => {
      const data = JSON.parse(raw) as { event: MatchEvent; state: MatchState }
      setStreamError(null)
      setFeedStatus('live')
      setLastFeedReceivedAt(Date.now())
      setScoresState(data.state)
      ckptScores = data.state
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
        const duplicate = ckptEvents.some(
          (item) =>
            (item.timestamp === data.event.timestamp && item.type === data.event.type) ||
            (item.data?.seq !== undefined && item.data?.seq === data.event.data?.seq)
        )
        if (!duplicate) ckptEvents = [...ckptEvents, data.event]
      }
      writeCheckpoint(data.event?.timestamp ?? data.state.lastUpdated)
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
      ckptCount += 1
      ckptUpdates = [...ckptUpdates.slice(-4), update]
      writeCheckpoint(update.timestamp)
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
      if (!ckptShocks.some((item) => item.firedAt === shock.firedAt && item.affectedTeam === shock.affectedTeam)) {
        ckptShocks = [...ckptShocks, shock]
      }
      writeCheckpoint(shock.firedAt)
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

    // Live safety net: SSE relays only forward events from the moment this
    // client connected, so a viewer who opens (or reconnects) after a goal
    // sees a stale score until the next event. Reconcile against the fixtures
    // snapshot periodically. Replay state comes only from the recorded stream.
    let reconcileTimer: ReturnType<typeof setInterval> | null = null
    if (!replayMode && !isDemo) {
      const reconcileScore = () => {
        fetch('/api/fixtures', { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            const fresh = (d?.fixtures as Fixture[] | undefined)?.find((f) => f.matchId === selectedMatchId)
            if (!fresh) return
            setActiveFixture((prev) => {
              if (!prev) return prev
              if (prev.homeScore === fresh.homeScore && prev.awayScore === fresh.awayScore && prev.phase === fresh.phase) {
                return prev
              }
              return { ...prev, homeScore: fresh.homeScore, awayScore: fresh.awayScore, phase: fresh.phase }
            })
          })
          .catch(() => undefined)
      }
      reconcileScore()
      reconcileTimer = setInterval(reconcileScore, 45_000)
    }

    if (replayMode) {
      const replaySpeed = isDemo ? DEMO_REPLAY_SPEED : STANDARD_REPLAY_SPEED
      const resumeParam = resumeAt !== undefined ? `&startAt=${resumeAt}` : ''
      oddsSource = new EventSource(`/api/replay?matchId=${selectedMatchId}&speed=${replaySpeed}${resumeParam}`)
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
        // A finished replay starts fresh next time rather than resuming at the end.
        try {
          sessionStorage.removeItem(checkpointKey)
        } catch {
          // Ignore storage errors.
        }
        ckptAt = 0
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
      // Flush the throttled checkpoint so navigation resumes at the exact spot.
      writeCheckpoint(ckptAt, true)
      if (reconcileTimer) clearInterval(reconcileTimer)
      scoresSource?.close()
      oddsSource?.close()
    }
  }, [selectedMatchId, activeFixture !== null, isDemo, isPaused, seekNonce])

  const handleSelectMatch = (fixture: Fixture) => {
    setIsPaused(false)
    setSliderMinute(null)
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
  const inReplay = isDemo || isCompletedPhase(activeFixture.phase)
  const inLive = isLivePhase(activeFixture.phase)
  // Where to return after signing in from inside this page — without this,
  // /auth always bounces back to a bare /watch, which re-picks a fixture from
  // scratch and loses the exact match/mode the visitor was on.
  const authReturnPath = isDemo ? '/watch?demo=true' : selectedMatchId ? `/watch?match=${selectedMatchId}` : '/watch'

  // Scrubber: slider position 0 = kickoff minus the engine's 5-minute
  // pre-match baseline, matching how a fresh replay starts; max covers a
  // full match plus extra time. Dragging computes an absolute timestamp and
  // hands it to requestSeek, which reopens the stream at that exact point.
  const scrubberBaseTs = activeFixture.kickoff - 5 * 60_000
  const scrubberMaxMinute = 125
  const currentVirtualMinute = Math.min(
    scrubberMaxMinute,
    Math.max(0, Math.round(((virtualNow ?? scrubberBaseTs) - scrubberBaseTs) / 60_000))
  )
  const displaySliderMinute = sliderMinute ?? currentVirtualMinute

  return (
    <div className={`relative ${mode === 'following' ? 'h-screen w-screen bg-black overflow-hidden' : 'min-h-screen bg-[#080808] pb-16'}`}>
      {/* Universal Mode Toggle Bar — capped to the viewport; overflow scrolls
          horizontally inside the pill instead of clipping off-screen on phones. */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 sm:gap-2 max-w-[calc(100vw-16px)] overflow-x-auto scrollbar-none whitespace-nowrap bg-gray-950/80 backdrop-blur-md border border-white/15 px-2 sm:px-3 py-1.5 rounded-full shadow-2xl">
        <span
          title={inReplay ? 'Recorded TxLINE data — practice only, Market IQ unaffected' : undefined}
          className={`shrink-0 flex items-center gap-1.5 pl-1 pr-2 sm:pr-2.5 border-r border-white/10 font-mono text-[10px] font-bold uppercase tracking-wider ${
            inReplay ? 'text-amber-400' : inLive ? 'text-emerald-400' : 'text-gray-500'
          }`}
        >
          {inReplay ? (
            '🔁 Replay'
          ) : inLive ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </>
          ) : (
            'Soon'
          )}
        </span>
        <button
          onClick={() => handleModeChange('following')}
          className={`shrink-0 px-2.5 sm:px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
            mode === 'following' ? 'bg-[#f5c518] text-black shadow-md' : 'text-gray-400 hover:text-white'
          }`}
        >
          Following
        </button>
        <button
          onClick={() => handleModeChange('watching')}
          className={`shrink-0 px-2.5 sm:px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
            mode === 'watching' ? 'bg-[#f5c518] text-black shadow-md' : 'text-gray-400 hover:text-white'
          }`}
        >
          Watching
        </button>
        {!isDemo && fixtures.length > 1 && (
          <MatchPicker fixtures={fixtures} selectedMatchId={selectedMatchId} onSelect={handleSelectMatch} />
        )}
        <Link
          href={user ? '/profile' : `/auth?next=${encodeURIComponent(authReturnPath)}`}
          className="shrink-0 pl-2 sm:pl-3 py-1.5 border-l border-white/10 text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-[#f5c518] transition-colors"
        >
          {user ? 'Profile' : 'Sign in'}
        </Link>
        <Link
          href="/guide"
          className="shrink-0 px-1 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-[#f5c518] transition-colors"
        >
          Guide
        </Link>
      </div>

      {/* Replay transport controls — play/pause + scrub. Never shown for a
          genuinely live match; only demo mode or an auto-replayed completed
          fixture. Positioned above SwipeFeed's own bottom swipe-hint so the
          two never overlap. */}
      {inReplay && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 w-[calc(100vw-16px)] max-w-md bg-gray-950/85 backdrop-blur-md border border-white/15 px-4 py-2.5 rounded-full shadow-2xl">
          <button
            onClick={() => setIsPaused((p) => !p)}
            aria-label={isPaused ? 'Play replay' : 'Pause replay'}
            className="shrink-0 w-8 h-8 rounded-full bg-[#f5c518] text-black flex items-center justify-center hover:bg-[#e2b514] transition-colors active:scale-95"
          >
            {isPaused ? (
              <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
              </svg>
            )}
          </button>
          <input
            type="range"
            min={0}
            max={scrubberMaxMinute}
            value={displaySliderMinute}
            onChange={(e) => setSliderMinute(Number(e.currentTarget.value))}
            onMouseUp={() => {
              if (sliderMinute !== null) requestSeek(scrubberBaseTs + sliderMinute * 60_000)
            }}
            onTouchEnd={() => {
              if (sliderMinute !== null) requestSeek(scrubberBaseTs + sliderMinute * 60_000)
            }}
            aria-label="Seek to match minute"
            className="flex-1 h-1.5 rounded-lg bg-gray-800 accent-[#f5c518] cursor-pointer outline-none"
          />
          <span className="shrink-0 font-mono text-[11px] font-bold text-gray-300 w-9 text-right" suppressHydrationWarning>
            {displaySliderMinute < 5 ? 'KO' : `${displaySliderMinute - 5}'`}
          </span>
        </div>
      )}

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
          isSignedIn={!!user}
          authReturnPath={authReturnPath}
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
          matchEvents={matchEvents}
          updateCount={updateCount}
          latestOdds={currentOdds ?? null}
          isDemo={isDemo}
          isSignedIn={!!user}
          authReturnPath={authReturnPath}
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

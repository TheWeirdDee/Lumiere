/**
 * Historical replay engine.
 *
 * Replays any completed match through the exact StreamCallbacks interface the
 * live stream uses. Raw records from the cache are pushed through the same
 * normalize.ts pipeline (ScoresNormalizer / OddsNormalizer / applyRecordToState),
 * so product code cannot tell replay from live: same event shapes, same
 * MatchState transitions, same dedupe/correction semantics.
 *
 * Historical data never changes, so cache files in data/replay-cache/ are
 * written once and read forever.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  getFixtureOrientation,
  getOddsRecordsRaw,
  getScoresRecordsRaw,
  getFixtures,
} from './snapshots'
import { OddsNormalizer, ScoresNormalizer, applyRecordToState, zeroMatchState } from './normalize'
import type {
  Fixture,
  MatchState,
  ReplayCache,
  ReplayControls,
  ReplayOptions,
  StreamCallbacks,
  TimelineEntry,
  TxLineScoresRecord,
  TxLineOddsRecord,
} from './types'

const CACHE_DIR = path.join(process.cwd(), 'data', 'replay-cache')

// ---------------------------------------------------------------------------
// Data acquisition + cache
// ---------------------------------------------------------------------------

function cachePath(matchId: string): string {
  return path.join(CACHE_DIR, `${matchId}.json`)
}

/** Fetch full raw history for a match and write data/replay-cache/{matchId}.json. */
export async function fetchAndCacheMatch(matchId: string): Promise<ReplayCache> {
  const [scores, odds, orientation] = await Promise.all([
    getScoresRecordsRaw(matchId),
    getOddsRecordsRaw(matchId),
    getFixtureOrientation(matchId),
  ])
  const cache: ReplayCache = {
    matchId,
    fetchedAt: Date.now(),
    orientation,
    scores,
    odds,
  }
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    fs.writeFileSync(cachePath(matchId), JSON.stringify(cache))
  } catch (e) {
    // Ignore write errors on read-only serverless systems
  }

  // Cache to Supabase database
  try {
    const { cacheMatch } = await import('@/lib/supabase')
    await cacheMatch(matchId, {
      homeTeam: orientation.homeTeam,
      awayTeam: orientation.awayTeam,
      matchDate: orientation.kickoff ? new Date(orientation.kickoff).toISOString() : new Date().toISOString(),
      oddsHistory: odds,
      scoresHistory: scores,
      shockCount: 0
    })
  } catch (e) {
    console.error('Failed to cache match in Supabase:', e)
  }

  return cache
}

/** Cache-first load: reads the file when present, fetches + caches otherwise. */
export async function loadReplayData(matchId: string): Promise<ReplayCache> {
  // 1. Try local filesystem cache first
  const file = cachePath(matchId)
  try {
    if (fs.existsSync(file)) {
      const cached = JSON.parse(fs.readFileSync(file, 'utf8')) as ReplayCache
      if (cached.matchId === matchId && Array.isArray(cached.scores)) return cached
    }
  } catch (e) {
    // Ignore local filesystem read errors
  }

  // 2. Try Supabase cache
  try {
    const { getCachedMatch } = await import('@/lib/supabase')
    const dbCached = await getCachedMatch(matchId)
    if (dbCached) {
      const orientation = await getFixtureOrientation(matchId)
      return {
        matchId: dbCached.match_id,
        fetchedAt: new Date(dbCached.cached_at || Date.now()).getTime(),
        orientation,
        scores: dbCached.events as TxLineScoresRecord[],
        odds: dbCached.odds_history as TxLineOddsRecord[],
      }
    }
  } catch (e) {
    console.error('Failed to read match cache from Supabase:', e)
  }

  // 3. Fallback: Fetch and cache
  return fetchAndCacheMatch(matchId)
}

/** Completed World Cup matches that have replayable historical data. */
export async function getReplayableMatches(): Promise<Fixture[]> {
  const fixtures = await getFixtures()
  const now = Date.now()
  return fixtures
    .filter((f) => f.phase !== 'C' && f.kickoff < now - 7 * 3600_000)
    .sort((a, b) => a.kickoff - b.kickoff)
}

// ---------------------------------------------------------------------------
// Replay playback
// ---------------------------------------------------------------------------

function buildTimeline(cache: ReplayCache): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...cache.scores.map((record): TimelineEntry => ({ kind: 'scores', timestamp: record.Ts, record })),
    ...cache.odds.map((record): TimelineEntry => ({ kind: 'odds', timestamp: record.Ts, record })),
  ]
  // Chronological; ties: scores before odds, then feed ordering.
  return entries.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
    if (a.kind !== b.kind) return a.kind === 'scores' ? -1 : 1
    if (a.kind === 'scores' && b.kind === 'scores') return a.record.Seq - b.record.Seq
    if (a.kind === 'odds' && b.kind === 'odds') {
      return a.record.MessageId.localeCompare(b.record.MessageId)
    }
    return 0
  })
}

function zeroState(cache: ReplayCache): MatchState {
  return zeroMatchState(cache.matchId, cache.orientation.homeTeam, cache.orientation.awayTeam)
}

/**
 * Start replaying a match through the live-stream callback interface.
 *
 * speed 1 = real time, 10 = 10x, 0 = instant (every event fires synchronously
 * before startReplay's promise resolves).
 */
export async function startReplay(
  options: ReplayOptions,
  callbacks: StreamCallbacks
): Promise<ReplayControls> {
  const cache = await loadReplayData(options.matchId)
  const fullTimeline = buildTimeline(cache)
  if (fullTimeline.length === 0) {
    throw new Error(`No replay data available for match ${options.matchId}`)
  }

  const timelineStart = fullTimeline[0].timestamp
  const timelineEnd = fullTimeline[fullTimeline.length - 1].timestamp
  
  const kickoff = cache.orientation.kickoff
  const defaultStart = kickoff && (kickoff - timelineStart > 30 * 60_000)
    ? kickoff - 5 * 60_000
    : timelineStart

  const startAt = Math.max(options.startAt ?? defaultStart, timelineStart)
  const endAt = Math.min(options.endAt ?? timelineEnd, timelineEnd)
  const timeline = fullTimeline.filter((e) => e.timestamp <= endAt)

  const p1IsHome = cache.orientation.participant1IsHome
  const scoresNormalizer = new ScoresNormalizer()
  const oddsNormalizer = new OddsNormalizer()
  let state = zeroState(cache)
  let index = 0 // next timeline entry to emit
  let virtualTime = startAt
  let playing = false
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let wallAnchor = 0 // Date.now() when playback (re)started
  let virtualAnchor = 0 // virtualTime at that moment

  /** Apply one entry to the pipeline; emit callbacks unless silent. */
  const applyEntry = (entry: TimelineEntry, silent: boolean): void => {
    if (entry.kind === 'scores') {
      state = applyRecordToState(state, entry.record)
      const event = scoresNormalizer.normalize(entry.record, p1IsHome)
      if (event && !silent) callbacks.onMatchEvent(event, state)
    } else {
      const event = oddsNormalizer.normalize(entry.record, p1IsHome)
      if (event && !silent) callbacks.onOddsEvent(event)
    }
  }

  /**
   * Position the pipeline at `target` without emitting: replays every prior
   * entry silently from the 0-0 baseline, so MatchState and both normalizers
   * hold exactly what a live consumer would hold at that moment.
   */
  const rebuildTo = (target: number): void => {
    scoresNormalizer.reset()
    oddsNormalizer.reset()
    state = zeroState(cache)
    // A replay knows its provenance: the match starts 0-0, so baseline the
    // counter dedupe there (a fresh normalizer would swallow the first goal).
    scoresNormalizer.seedFromState(state)
    index = 0
    while (index < timeline.length && timeline[index].timestamp < target) {
      applyEntry(timeline[index], true)
      index += 1
    }
    virtualTime = target
  }

  const currentVirtual = (): number => {
    if (!playing) return virtualTime
    return Math.min(virtualAnchor + (Date.now() - wallAnchor) * options.speed, endAt)
  }

  const clearTimer = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  const scheduleNext = (): void => {
    clearTimer()
    if (stopped || !playing) return
    if (index >= timeline.length) {
      playing = false
      virtualTime = endAt
      return
    }
    const nextTs = timeline[index].timestamp
    const delayMs = Math.max(0, (nextTs - currentVirtual()) / options.speed)
    timer = setTimeout(() => {
      if (stopped || !playing) return
      const now = currentVirtual()
      while (index < timeline.length && timeline[index].timestamp <= now) {
        applyEntry(timeline[index], false)
        index += 1
      }
      virtualTime = now
      scheduleNext()
    }, delayMs)
  }

  // Initial positioning
  rebuildTo(startAt)

  if (options.speed === 0) {
    // Instant mode: emit everything synchronously, no timers.
    while (index < timeline.length) {
      applyEntry(timeline[index], false)
      index += 1
    }
    virtualTime = endAt
  } else {
    playing = true
    wallAnchor = Date.now()
    virtualAnchor = virtualTime
    scheduleNext()
  }

  return {
    pause: () => {
      if (stopped || !playing) return
      virtualTime = currentVirtual()
      playing = false
      clearTimer()
    },
    resume: () => {
      if (stopped || playing || options.speed === 0) return
      playing = true
      wallAnchor = Date.now()
      virtualAnchor = virtualTime
      scheduleNext()
    },
    // Preserves play/pause state. When playback has finished (which counts
    // as paused), seek() repositions silently — call resume() to play again.
    seek: (timestamp: number) => {
      if (stopped) return
      const target = Math.min(Math.max(timestamp, timelineStart), endAt)
      const wasPlaying = playing
      playing = false
      clearTimer()
      rebuildTo(target)
      if (wasPlaying && options.speed !== 0) {
        playing = true
        wallAnchor = Date.now()
        virtualAnchor = virtualTime
        scheduleNext()
      }
    },
    stop: () => {
      stopped = true
      playing = false
      clearTimer()
    },
    getCurrentTime: () => currentVirtual(),
    getDuration: () => endAt - startAt,
  }
}

import type { OddsEvent } from './txline/types'
import type { OddsShock } from '../types'

const SHOCK_THRESHOLD = 0.15   // 15% probability shift
const SHOCK_WINDOW_MS = 90_000 // 90 second rolling window

interface OddsPoint {
  prob: number;
  timestamp: number;
}

function checkWindow(
  windows: Map<string, OddsPoint[]>,
  matchId: string,
  currentProb: number,
  now: number
): { delta: number; windowSeconds: number; preProb: number } | null {
  const key = matchId
  const current = windows.get(key) || []
  const filtered = current.filter(p => now - p.timestamp < SHOCK_WINDOW_MS)
  
  filtered.push({ prob: currentProb, timestamp: now })
  windows.set(key, filtered)
  
  if (filtered.length < 2) return null
  
  const oldest = filtered[0]
  const delta = currentProb - oldest.prob
  
  if (Math.abs(delta) < SHOCK_THRESHOLD) return null
  
  // Reset window buffer to establish new baseline and prevent duplicate triggers
  windows.set(key, [])
  
  return {
    delta,
    windowSeconds: Math.round((now - oldest.timestamp) / 1000),
    preProb: oldest.prob,
  }
}

export interface ShockDetector {
  detect: (update: OddsEvent, matchState: { homeTeam: string; awayTeam: string }) => OddsShock | null
  reset: (matchId: string) => void
}

/**
 * A detector owns its rolling windows. Create one per SSE session so separate
 * viewers and replay reconnects cannot contaminate each other's baselines.
 */
export function createShockDetector(): ShockDetector {
  const homeWindows = new Map<string, OddsPoint[]>()
  const awayWindows = new Map<string, OddsPoint[]>()

  return {
    detect(update, matchState) {
      if (update.market !== '1X2_PARTICIPANT_RESULT') return null

      const now = update.timestamp
      const homeResult = checkWindow(homeWindows, update.matchId, update.homeProb, now)
      if (homeResult) {
        return {
          matchId: update.matchId,
          homeTeam: matchState.homeTeam,
          awayTeam: matchState.awayTeam,
          affectedTeam: 'home',
          direction: homeResult.delta > 0 ? 'up' : 'down',
          delta: Math.abs(homeResult.delta),
          windowSeconds: homeResult.windowSeconds,
          preProb: homeResult.preProb,
          postProb: update.homeProb,
          firedAt: now,
        }
      }

      const awayResult = checkWindow(awayWindows, update.matchId, update.awayProb, now)
      if (awayResult) {
        return {
          matchId: update.matchId,
          homeTeam: matchState.homeTeam,
          awayTeam: matchState.awayTeam,
          affectedTeam: 'away',
          direction: awayResult.delta > 0 ? 'up' : 'down',
          delta: Math.abs(awayResult.delta),
          windowSeconds: awayResult.windowSeconds,
          preProb: awayResult.preProb,
          postProb: update.awayProb,
          firedAt: now,
        }
      }

      return null
    },
    reset(matchId) {
      homeWindows.delete(matchId)
      awayWindows.delete(matchId)
    }
  }
}

const sharedDetector = createShockDetector()

/** Backwards-compatible singleton for scripts that process one match at a time. */
export const detectShock = sharedDetector.detect

export function resetDetector(matchId: string) {
  sharedDetector.reset(matchId)
}

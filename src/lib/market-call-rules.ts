import type { MarketCallChoice, MarketCallStatus } from '@/types'

export const MARKET_CALL_HORIZON_MS = 5 * 60_000
export const MARKET_CALL_WINDOW_MS = 30_000
export const FOLLOW_RETENTION_THRESHOLD = 0.55
export const FADE_RETENTION_THRESHOLD = 0.45

export interface MarketCallResolution {
  retention: number
  status: MarketCallStatus
  iqDelta: number
}

/**
 * A move is followed when at least 55% of the original probability shock is
 * still present five TxLINE event-minutes later. It is faded below 45%; the
 * dead-band is a push so tiny market noise cannot decide a call.
 */
export function resolveMarketCall(
  choice: MarketCallChoice,
  preProb: number,
  postProb: number,
  resolvedProb: number
): MarketCallResolution {
  const move = postProb - preProb
  if (![preProb, postProb, resolvedProb].every(Number.isFinite) || Math.abs(move) < 0.0001) {
    return { retention: 0.5, status: 'push', iqDelta: 0 }
  }

  const retention = (resolvedProb - preProb) / move
  const marketOutcome: MarketCallChoice | 'push' =
    retention >= FOLLOW_RETENTION_THRESHOLD
      ? 'follow'
      : retention <= FADE_RETENTION_THRESHOLD
        ? 'fade'
        : 'push'

  if (marketOutcome === 'push') return { retention, status: 'push', iqDelta: 0 }
  const won = marketOutcome === choice
  return { retention, status: won ? 'won' : 'lost', iqDelta: won ? 10 : -5 }
}


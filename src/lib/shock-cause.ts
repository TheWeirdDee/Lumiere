// Presentation-layer inference: connects an odds shock to the match event that
// most plausibly caused it (goal, red card, penalty). Pure functions over data
// the client already has — never touches shock detection, scoring or storage.
// Works identically live and in replay because both shock.firedAt and
// MatchEvent.timestamp carry original TxLINE event time.

import type { MatchEvent, OddsEvent } from './txline/types'
import type { OddsShock } from '@/types'

/** How far back a match event can be and still explain a shock. */
const CAUSE_LOOKBACK_MS = 4 * 60_000
/** Feed jitter allowance: the odds tick can land slightly before the score tick. */
const CAUSE_LOOKAHEAD_MS = 30_000

const CAUSE_TYPES = new Set(['goal', 'red_card', 'penalty'])

export interface ShockCause {
  type: 'goal' | 'red_card' | 'penalty' | null
  minute: number | null
  /** Which side the causing event belongs to, when attributed. */
  team: 'home' | 'away' | null
  /** One-line plain-English reading of why the market moved. */
  narrative: string
  /** Compact label for badges, e.g. "⚽ Goal 67'". */
  label: string | null
}

function eventLabel(type: string, minute: number | null): string {
  const icon = type === 'goal' ? '⚽ Goal' : type === 'red_card' ? '🟥 Red card' : '⚪ Penalty'
  return minute && minute > 0 ? `${icon} ${minute}'` : icon
}

/**
 * Find the most recent goal / red card / penalty near the shock window and
 * phrase what the market's reaction means for the affected team.
 */
export function inferShockCause(shock: OddsShock, matchEvents: MatchEvent[]): ShockCause {
  const team = shock.affectedTeam === 'home' ? shock.homeTeam : shock.awayTeam
  const rising = shock.direction === 'up'

  const candidates = matchEvents
    .filter(
      (e) =>
        CAUSE_TYPES.has(e.type) &&
        e.timestamp >= shock.firedAt - CAUSE_LOOKBACK_MS &&
        e.timestamp <= shock.firedAt + CAUSE_LOOKAHEAD_MS
    )
    .sort((a, b) => b.timestamp - a.timestamp)

  const cause = candidates[0]

  if (!cause) {
    return {
      type: null,
      minute: null,
      team: null,
      narrative: rising
        ? `No goal, no card — the market started believing in ${team} on momentum alone.`
        : `Nothing on the scoresheet — confidence in ${team} is draining on momentum alone.`,
      label: null,
    }
  }

  const causeType = cause.type as 'goal' | 'red_card' | 'penalty'
  const minute = cause.minute > 0 ? cause.minute : null
  const sameSide = cause.team === shock.affectedTeam
  const minuteText = minute ? ` in the ${minute}'` : ''

  let narrative: string
  if (causeType === 'goal') {
    narrative = rising
      ? sameSide
        ? `The market is reacting to ${team}'s goal${minuteText} — bookmakers now believe they've taken control.`
        : `The goal${minuteText} swung the market — bookmakers still moved towards ${team}.`
      : sameSide
        ? `Even after the goal${minuteText}, the market is backing away from ${team}.`
        : `The goal${minuteText} hit ${team}'s chances hard — the market repriced immediately.`
  } else if (causeType === 'red_card') {
    narrative = rising
      ? `The red card${minuteText} changed everything — the market now favours ${team} against 10 men.`
      : `Down a man after the red card${minuteText}, ${team}'s chances are collapsing in the market.`
  } else {
    narrative = rising
      ? `A penalty${minuteText} has the market rushing towards ${team}.`
      : `The penalty${minuteText} turned the market against ${team}.`
  }

  return { type: causeType, minute, team: cause.team, narrative, label: eventLabel(causeType, minute) }
}

export type MarketMood = 'calm' | 'moving' | 'building' | 'reacting' | 'shock'

/**
 * One-line reading of the current market state for ambient surfaces.
 * Derived from data already on screen — recent ticks, events and shocks.
 */
export function marketTagline(input: {
  recentUpdates: OddsEvent[]
  matchEvents: MatchEvent[]
  activeShock: OddsShock | null
  latestOdds: OddsEvent | null
}): { mood: MarketMood; text: string } {
  const { recentUpdates, matchEvents, activeShock, latestOdds } = input
  const feedNow = latestOdds?.timestamp ?? 0

  if (activeShock && feedNow - activeShock.firedAt < 3 * 60_000) {
    const cause = inferShockCause(activeShock, matchEvents)
    return {
      mood: 'shock',
      text: cause.type ? `Odds shock — ${cause.type === 'goal' ? 'the market is reacting to the goal' : cause.type === 'red_card' ? 'the market is reacting to the red card' : 'the market is reacting to the penalty'}.` : 'Odds shock detected.',
    }
  }

  const recentBigEvent = matchEvents.some(
    (e) => CAUSE_TYPES.has(e.type) && feedNow - e.timestamp >= 0 && feedNow - e.timestamp < 2 * 60_000
  )
  if (recentBigEvent) {
    return { mood: 'reacting', text: 'The market is reacting to the last big moment.' }
  }

  const drift = recentUpdates.reduce(
    (sum, u) => sum + Math.max(Math.abs(u.deltaHome), Math.abs(u.deltaAway), Math.abs(u.deltaDraw)),
    0
  )
  if (drift >= 0.05) return { mood: 'building', text: 'Momentum is building in the market.' }
  if (drift >= 0.015) return { mood: 'moving', text: 'The market is moving.' }
  return { mood: 'calm', text: 'The market is calm.' }
}

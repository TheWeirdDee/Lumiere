import assert from 'node:assert/strict'
import { loadReplayData, startReplay } from '../src/lib/txline/replay'
import { OddsNormalizer } from '../src/lib/txline/normalize'
import { isPrimaryMarket, PRIMARY_MARKET } from '../src/lib/primary-market'
import type { GamePhase, MatchState, OddsEvent } from '../src/lib/txline/types'

async function main() {
const matchId = process.argv[2] || process.env.NEXT_PUBLIC_DEMO_MATCH_ID || '18202701'
const cache = await loadReplayData(matchId)
const kickoff = cache.orientation.kickoff
assert(kickoff, `Replay ${matchId} has no kickoff timestamp`)

const orderedScoreSeqs = [...cache.scores]
  .sort((a, b) => a.Seq - b.Seq)
  .map((record) => record.Seq)
const missingScoreSequenceRanges: string[] = []
for (let i = 1; i < orderedScoreSeqs.length; i += 1) {
  const previous = orderedScoreSeqs[i - 1]
  const current = orderedScoreSeqs[i]
  if (current > previous + 1) {
    missingScoreSequenceRanges.push(`${previous + 1}-${current - 1}`)
  }
}
assert.deepEqual(
  missingScoreSequenceRanges,
  [],
  `Raw scores history has missing Seq ranges: ${missingScoreSequenceRanges.join(', ')}`
)

const phaseRank: Partial<Record<GamePhase, number>> = {
  NS: 0,
  H1: 1,
  HT: 2,
  H2: 3,
  WET: 4,
  ET1: 5,
  HTET: 6,
  ET2: 7,
  WPE: 8,
  PE: 9,
  F: 10,
  FET: 10,
  FPE: 10,
}

const violations: string[] = []
const oddsIds = new Set<string>()
let oddsCount = 0
let scoreEventCount = 0
let completeCount = 0
let maxMinute = 0
let lastTimestamp = kickoff - 5 * 60_000
let highestPhaseRank = 0
let finalState: MatchState | null = null

function checkTimestamp(timestamp: number, label: string) {
  if (timestamp < lastTimestamp) {
    violations.push(`${label} timestamp moved backwards: ${timestamp} < ${lastTimestamp}`)
  }
  lastTimestamp = Math.max(lastTimestamp, timestamp)
}

const controls = await startReplay(
  { matchId, speed: 0, startAt: kickoff - 5 * 60_000 },
  {
    onMatchEvent(event, state) {
      checkTimestamp(event.timestamp, `score seq ${String(event.data.seq)}`)
      scoreEventCount += 1
      maxMinute = Math.max(maxMinute, state.minute)
      const rank = phaseRank[state.phase]
      if (rank !== undefined) {
        if (rank < highestPhaseRank) {
          violations.push(`phase regressed from rank ${highestPhaseRank} to ${rank} at ${event.timestamp}`)
        }
        highestPhaseRank = Math.max(highestPhaseRank, rank)
      }
      finalState = state
    },
    onOddsEvent(event: OddsEvent) {
      if (!isPrimaryMarket(event)) return
      checkTimestamp(event.timestamp, 'odds')
      oddsCount += 1
      const messageId = (event.raw as { MessageId?: unknown } | null)?.MessageId
      if (typeof messageId === 'string') {
        if (oddsIds.has(messageId)) violations.push(`duplicate odds MessageId ${messageId}`)
        oddsIds.add(messageId)
      }
    },
    onError(error) {
      violations.push(`engine error: ${error.message}`)
    },
    onReconnect() {
      violations.push('finite replay unexpectedly reconnected')
    },
    onComplete() {
      completeCount += 1
    },
  }
)

const verifier = new OddsNormalizer()
const expectedPrimaryCount = [...cache.odds]
  .sort((a, b) => a.Ts - b.Ts || a.MessageId.localeCompare(b.MessageId))
  .reduce((count, record) => {
    const event = verifier.normalize(record, cache.orientation.participant1IsHome)
    return count + (record.Ts >= kickoff - 5 * 60_000 && event?.market === PRIMARY_MARKET ? 1 : 0)
  }, 0)

assert.equal(completeCount, 1, 'Replay must complete exactly once')
assert(controls.getCurrentTime() >= lastTimestamp, 'Replay controls finished behind the final emitted event')
assert(oddsCount > 0, 'Replay emitted no full-match win odds')
assert.equal(oddsCount, expectedPrimaryCount, 'Primary-market filter lost or added odds records')
assert(scoreEventCount > 0, 'Replay emitted no score events')
assert(maxMinute >= 90, `Replay never reached the 90th match minute (max ${maxMinute})`)
const completedState = finalState as MatchState | null
assert(completedState && ['F', 'FET', 'FPE'].includes(completedState.phase), `Replay did not reach full time (phase ${completedState?.phase ?? 'none'})`)
assert.deepEqual(violations, [], violations.join('\n'))

console.log(JSON.stringify({
  matchId,
  teams: `${cache.orientation.homeTeam} vs ${cache.orientation.awayTeam}`,
  rawScoreRecords: cache.scores.length,
  missingScoreSequenceRanges,
  recordedTimelineMinutes: Math.round(controls.getDuration() / 60_000),
  maxMatchMinute: maxMinute,
  scoreEvents: scoreEventCount,
  fullMatchOddsUpdates: oddsCount,
  ignoredNonPrimaryOrPreMatchUpdates: cache.odds.length - expectedPrimaryCount,
  finalPhase: completedState.phase,
  finalScore: `${completedState.homeScore}-${completedState.awayScore}`,
  completionEvents: completeCount,
  errors: violations,
}, null, 2))
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

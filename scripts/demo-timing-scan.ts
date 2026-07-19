// One-off analysis: for a match's recorded data, find every goal, red card,
// and shock, report the real match minute each one happened at (the same
// number the in-app scrubber and the "67' Minute" clock use), plus a
// ready-to-use ?startAt= jump URL for opening the demo already at that point.
import { loadReplayData, startReplay } from '../src/lib/txline/replay'
import { createShockDetector } from '../src/lib/shock-detector'
import { isPrimaryMarket } from '../src/lib/primary-market'
import type { MatchEvent, OddsEvent } from '../src/lib/txline/types'

async function scan(matchId: string) {
  const cache = await loadReplayData(matchId)
  const kickoff = cache.orientation.kickoff
  if (!kickoff) throw new Error('no kickoff')
  const timelineStart = kickoff - 5 * 60_000
  const detector = createShockDetector()

  type Row = { minute: number; type: string; detail: string; absoluteTs: number }
  const rows: Row[] = []
  let currentMinute = 0

  await startReplay(
    { matchId, speed: 0, startAt: timelineStart },
    {
      onMatchEvent(event: MatchEvent, state) {
        currentMinute = state.minute
        if (event.type === 'goal') {
          const scorer = event.team === 'home' ? cache.orientation.homeTeam : cache.orientation.awayTeam
          rows.push({ minute: state.minute, type: 'GOAL', detail: `${scorer} scores — now ${state.homeScore}-${state.awayScore}`, absoluteTs: event.timestamp })
        }
        if (event.type === 'red_card') {
          rows.push({ minute: state.minute, type: 'RED CARD', detail: event.team ?? 'unknown side', absoluteTs: event.timestamp })
        }
      },
      onOddsEvent(event: OddsEvent) {
        if (!isPrimaryMarket(event)) return
        const shock = detector.detect(event, { homeTeam: cache.orientation.homeTeam, awayTeam: cache.orientation.awayTeam })
        if (shock) {
          const team = shock.affectedTeam === 'home' ? shock.homeTeam : shock.awayTeam
          rows.push({
            minute: currentMinute, // the most recent known match minute — odds events carry no minute of their own
            type: 'SHOCK',
            detail: `${team} ${shock.direction} ${Math.round(shock.delta * 100)}% (${Math.round(shock.preProb * 100)}%→${Math.round(shock.postProb * 100)}%)`,
            absoluteTs: shock.firedAt,
          })
        }
      },
      onError() {},
      onReconnect() {},
      onComplete() {},
    }
  )

  // ?demo=true always loads the hardcoded NEXT_PUBLIC_DEMO_MATCH_ID (18202701)
  // regardless of matchId — any other completed match auto-replays via ?match=.
  const demoDefault = process.env.NEXT_PUBLIC_DEMO_MATCH_ID || '18202701'
  const jumpParam = matchId === demoDefault ? 'demo=true' : `match=${matchId}`

  console.log(`\n${cache.orientation.homeTeam} vs ${cache.orientation.awayTeam} (${matchId}):\n`)
  for (const row of rows) {
    const jumpAt = Math.max(timelineStart, row.absoluteTs - 15_000) // land ~15 virtual seconds early
    console.log(`  ${row.minute}'`.padEnd(6) + ` ${row.type.padEnd(10)} ${row.detail}`)
    console.log(`         jump: /watch?${jumpParam}&startAt=${jumpAt}`)
  }
}

async function main() {
  await scan(process.argv[2] || '18202701')
}

void main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

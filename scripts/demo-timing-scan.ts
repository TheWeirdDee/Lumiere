// One-off analysis: for a match's fresh /watch?demo=true playback (5x speed,
// starting from the engine's default pre-kickoff baseline), compute the
// real wall-clock offset at which each goal, red card, and shock actually
// appears — so a demo recording can be timed precisely instead of guessed.
import { loadReplayData, startReplay } from '../src/lib/txline/replay'
import { createShockDetector } from '../src/lib/shock-detector'
import { isPrimaryMarket } from '../src/lib/primary-market'
import type { MatchEvent, OddsEvent } from '../src/lib/txline/types'

const DEMO_SPEED = 5

async function scan(matchId: string) {
  const cache = await loadReplayData(matchId)
  const kickoff = cache.orientation.kickoff
  if (!kickoff) throw new Error('no kickoff')
  const timelineStart = kickoff - 5 * 60_000 // matches replay.ts defaultStart for this match (pre-window > 30min)
  const detector = createShockDetector()

  type Row = { wallClock: string; minute: number; type: string; detail: string; absoluteTs: number }
  const rows: Row[] = []

  const fmt = (virtualTs: number) => {
    const seconds = Math.round((virtualTs - timelineStart) / DEMO_SPEED / 1000)
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  await startReplay(
    { matchId, speed: 0, startAt: timelineStart },
    {
      onMatchEvent(event: MatchEvent, state) {
        if (event.type === 'goal') {
          const scorer = event.team === 'home' ? cache.orientation.homeTeam : cache.orientation.awayTeam
          rows.push({ wallClock: fmt(event.timestamp), minute: state.minute, type: 'GOAL', detail: `${scorer} scores — now ${state.homeScore}-${state.awayScore}`, absoluteTs: event.timestamp })
        }
        if (event.type === 'red_card') {
          rows.push({ wallClock: fmt(event.timestamp), minute: state.minute, type: 'RED CARD', detail: event.team ?? 'unknown side', absoluteTs: event.timestamp })
        }
      },
      onOddsEvent(event: OddsEvent) {
        if (!isPrimaryMarket(event)) return
        const shock = detector.detect(event, { homeTeam: cache.orientation.homeTeam, awayTeam: cache.orientation.awayTeam })
        if (shock) {
          const team = shock.affectedTeam === 'home' ? shock.homeTeam : shock.awayTeam
          rows.push({
            wallClock: fmt(shock.firedAt),
            minute: 0,
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

  console.log(`\n${cache.orientation.homeTeam} vs ${cache.orientation.awayTeam} (${matchId}) — demo timeline at ${DEMO_SPEED}x, from fresh start:\n`)
  for (const row of rows) {
    const jumpAt = Math.max(timelineStart, row.absoluteTs - 15_000) // land ~15 virtual seconds early
    console.log(`  ${row.wallClock.padEnd(6)} ${row.type.padEnd(10)} ${row.detail}`)
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

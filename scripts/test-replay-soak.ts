import assert from 'node:assert/strict'
import { loadReplayData, startReplay } from '../src/lib/txline/replay'
import type { GamePhase, MatchState, ReplayControls } from '../src/lib/txline/types'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  const matchId = process.argv[2] || process.env.NEXT_PUBLIC_DEMO_MATCH_ID || '18202701'
  const cache = await loadReplayData(matchId)
  const kickoff = cache.orientation.kickoff
  assert(kickoff, `Replay ${matchId} has no kickoff timestamp`)
  const startAt = kickoff - 5 * 60_000

  const paceControls = await startReplay(
    { matchId, speed: 1, startAt, endAt: startAt + 60_000 },
    {
      onMatchEvent() {},
      onOddsEvent() {},
      onError(error) { throw error },
      onReconnect() {},
    }
  )
  const paceVirtualStart = paceControls.getCurrentTime()
  const paceStart = Date.now()
  await sleep(10_000)
  const paceWallMs = Date.now() - paceStart
  const paceVirtualMs = paceControls.getCurrentTime() - paceVirtualStart
  paceControls.stop()
  const oneXRate = paceVirtualMs / paceWallMs
  assert(oneXRate >= 0.95 && oneXRate <= 1.05, `1x clock rate was ${oneXRate.toFixed(3)}x`)

  const phaseRank: Partial<Record<GamePhase, number>> = {
    NS: 0, H1: 1, HT: 2, H2: 3, WET: 4, ET1: 5,
    HTET: 6, ET2: 7, WPE: 8, PE: 9, F: 10, FET: 10, FPE: 10,
  }
  const violations: string[] = []
  let controls: ReplayControls | null = null
  let finalState: MatchState | null = null
  let maxMinute = 0
  let lastMinute = 0
  let highestPhase = 0
  let lastTimestamp = startAt
  let updateCount = 0
  let nextReportMinute = 15
  const soakStart = Date.now()

  await new Promise<void>(async (resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('90-minute replay soak timed out')), 180_000)
    try {
      controls = await startReplay(
        { matchId, speed: 60, startAt },
        {
          onMatchEvent(event, state) {
            if (event.timestamp < lastTimestamp) violations.push(`score timestamp regressed at ${event.timestamp}`)
            lastTimestamp = Math.max(lastTimestamp, event.timestamp)
            const rank = phaseRank[state.phase]
            if (rank !== undefined && rank < highestPhase) violations.push(`phase regressed to ${state.phase}`)
            if (rank !== undefined) highestPhase = Math.max(highestPhase, rank)
            if (state.phase === finalState?.phase && state.minute < lastMinute - 10) {
              violations.push(`match minute regressed from ${lastMinute} to ${state.minute}`)
            }
            lastMinute = state.minute
            maxMinute = Math.max(maxMinute, state.minute)
            finalState = state
            updateCount += 1
            if (maxMinute >= nextReportMinute) {
              console.log(`monitor: reached ${maxMinute}' (${state.phase}) without restart`)
              nextReportMinute += 15
            }
            if (maxMinute >= 90) {
              clearTimeout(timeout)
              controls?.stop()
              resolve()
            }
          },
          onOddsEvent(event) {
            if (event.timestamp < lastTimestamp) violations.push(`odds timestamp regressed at ${event.timestamp}`)
            lastTimestamp = Math.max(lastTimestamp, event.timestamp)
            updateCount += 1
          },
          onError(error) {
            violations.push(error.message)
          },
          onReconnect() {
            violations.push('engine unexpectedly reconnected')
          },
          onComplete() {
            if (maxMinute < 90) reject(new Error(`Replay completed at minute ${maxMinute}`))
          },
        }
      )
    } catch (error) {
      clearTimeout(timeout)
      reject(error)
    }
  })

  const wallMs = Date.now() - soakStart
  const virtualMs = controls!.getCurrentTime() - startAt
  const observedState = finalState as MatchState | null
  assert.deepEqual(violations, [], violations.join('\n'))
  assert(maxMinute >= 90)

  console.log(JSON.stringify({
    matchId,
    teams: `${cache.orientation.homeTeam} vs ${cache.orientation.awayTeam}`,
    oneXClockRate: Number(oneXRate.toFixed(3)),
    monitoredMatchMinutes: maxMinute,
    acceleratedSoakWallSeconds: Math.round(wallMs / 1000),
    acceleratedVirtualMinutes: Math.round(virtualMs / 60_000),
    observedAcceleratedRate: Number((virtualMs / wallMs).toFixed(2)),
    eventsObserved: updateCount,
    finalObservedPhase: observedState?.phase,
    errors: violations,
  }, null, 2))
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { GET } from '../src/app/api/replay/route'
import { PRIMARY_MARKET } from '../src/lib/primary-market'
import { loadReplayData } from '../src/lib/txline/replay'

interface SseEvent {
  event: string
  id: number | null
  data: unknown
}

async function main() {
const matchId = process.argv[2] || process.env.NEXT_PUBLIC_DEMO_MATCH_ID || '18202701'
const cache = await loadReplayData(matchId)
assert(cache.orientation.kickoff, `Replay ${matchId} has no kickoff timestamp`)
const startAt = cache.orientation.kickoff - 5 * 60_000

async function sample(lastEventId?: number): Promise<SseEvent[]> {
  const abort = new AbortController()
  const headers = new Headers()
  if (lastEventId !== undefined) headers.set('last-event-id', String(lastEventId))
  const request = new NextRequest(
    `http://localhost/api/replay?matchId=${matchId}&speed=1000&startAt=${startAt}`,
    { headers, signal: abort.signal }
  )
  const response = await GET(request)
  assert.equal(response.status, 200)
  assert(response.body)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const events: SseEvent[] = []
  let buffer = ''

  try {
    while (events.length < 30) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const lines = block.split('\n')
        const event = lines.find((line) => line.startsWith('event: '))?.slice(7)
        const idLine = lines.find((line) => line.startsWith('id: '))?.slice(4)
        const dataLine = lines.find((line) => line.startsWith('data: '))?.slice(6)
        if (event && dataLine) {
          events.push({
            event,
            id: idLine ? Number(idLine) : null,
            data: JSON.parse(dataLine),
          })
        }
        boundary = buffer.indexOf('\n\n')
      }
    }
  } finally {
    abort.abort()
    await reader.cancel().catch(() => undefined)
  }
  return events
}

const first = await sample()
const firstWithIds = first.filter((event) => event.id !== null)
assert(firstWithIds.length > 5, 'Initial SSE sample returned too few replay events')
const checkpoint = firstWithIds[firstWithIds.length - 1].id
assert(checkpoint !== null)

const resumed = await sample(checkpoint)
const resumedWithIds = resumed.filter((event) => event.id !== null)
assert(resumedWithIds.length > 0, 'Resumed SSE sample returned no replay events')
assert(resumedWithIds[0].id! >= checkpoint, 'Last-Event-ID reconnect restarted before its checkpoint')

for (const item of [...first, ...resumed]) {
  if (item.event === 'replay-error') throw new Error(JSON.stringify(item.data))
  if (item.event !== 'odds') continue
  const odds = item.data as { market?: string }
  assert.equal(odds.market, PRIMARY_MARKET, 'SSE exposed a non-full-match market')
}

console.log(JSON.stringify({
  matchId,
  initialEvents: first.length,
  reconnectCheckpoint: checkpoint,
  firstResumedEvent: resumedWithIds[0].id,
  resumedWithoutRestart: true,
  onlyPrimaryMarketExposed: true,
}, null, 2))
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

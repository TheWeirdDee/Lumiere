import { NextRequest } from 'next/server'
import { startReplay } from '@/lib/txline/replay'
import { getFixtureOrientation } from '@/lib/txline/snapshots'
import { createShockDetector } from '@/lib/shock-detector'
import { generateExplanation } from '@/lib/ai-explain'
import { isPrimaryMarket } from '@/lib/primary-market'
import type { ReplayControls, MatchEvent, MatchState, OddsEvent } from '@/lib/txline/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function parseTimestamp(value: string | null): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function GET(request: NextRequest) {
  const matchId = request.nextUrl.searchParams.get('matchId')
  const speedParam = Number(request.nextUrl.searchParams.get('speed') ?? 5)
  const speed = Number.isFinite(speedParam) && speedParam >= 0 ? speedParam : 5

  const requestedStartAt = parseTimestamp(request.nextUrl.searchParams.get('startAt'))
  const reconnectStartAt = parseTimestamp(request.headers.get('last-event-id'))
  const startAt = [requestedStartAt, reconnectStartAt].filter((value): value is number => value !== undefined)
  const resumeAt = startAt.length > 0 ? Math.max(...startAt) : undefined

  if (!matchId) {
    return new Response('Missing matchId', { status: 400 })
  }

  const encoder = new TextEncoder()
  let controls: ReplayControls | null = null
  let pingInterval: ReturnType<typeof setInterval> | null = null
  let closed = false

  const cleanup = () => {
    if (closed) return
    closed = true
    if (pingInterval) clearInterval(pingInterval)
    controls?.stop()
  }

  const stream = new ReadableStream({
    async start(controller) {
      const detector = createShockDetector()
      const send = (event: string, data: unknown, id?: number) => {
        if (closed) return
        try {
          const idLine = id === undefined ? '' : `id: ${Math.trunc(id)}\n`
          controller.enqueue(encoder.encode(`${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          cleanup()
        }
      }

      pingInterval = setInterval(() => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`))
        } catch {
          cleanup()
        }
      }, 30_000)
      request.signal.addEventListener('abort', cleanup, { once: true })

      try {
        // Resolve fixture orientation for team names to check shocks
        const orientation = await getFixtureOrientation(matchId)
        if (closed) return
        
        controls = await startReplay(
          { matchId, speed, startAt: resumeAt },
          {
            onMatchEvent: (event: MatchEvent, state: MatchState) => {
              send('event', { event, state }, event.timestamp)
            },
            onOddsEvent: (event: OddsEvent) => {
              if (!isPrimaryMarket(event)) return
              send('odds', event, event.timestamp)

              // Run shock detection on odds update in replay mode — identical
              // pipeline to the live relay, including the AI explanation.
              const shock = detector.detect(event, {
                homeTeam: orientation.homeTeam,
                awayTeam: orientation.awayTeam,
              })
              if (shock) {
                void (async () => {
                  shock.explanation = await generateExplanation(shock)
                  send('shock', shock)
                })()
              }
            },
            onError: (err: Error) => {
              send('replay-error', { message: err.message })
            },
            onReconnect: () => {
              // Not applicable to replay
            },
            onComplete: () => {
              send('complete', { matchId })
              cleanup()
              try {
                controller.close()
              } catch {
                // Stream may already be closed.
              }
            },
          }
        )
        if (closed) controls.stop()
      } catch (err) {
        send('replay-error', { message: err instanceof Error ? err.message : String(err) })
        cleanup()
        try {
          controller.close()
        } catch {
          // Ignore close errors
        }
        return
      }

    },
    cancel() {
      cleanup()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  })
}

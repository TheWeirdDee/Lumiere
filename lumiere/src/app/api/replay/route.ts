import { NextRequest } from 'next/server'
import { startReplay } from '@/lib/txline/replay'
import { getFixtureOrientation } from '@/lib/txline/snapshots'
import { detectShock } from '@/lib/shock-detector'
import { generateExplanation } from '@/lib/ai-explain'
import type { ReplayControls, MatchEvent, MatchState, OddsEvent } from '@/lib/txline/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const matchId = request.nextUrl.searchParams.get('matchId')
  const speedParam = request.nextUrl.searchParams.get('speed')
  const speed = speedParam ? Number(speedParam) : 5
  
  const startAtParam = request.nextUrl.searchParams.get('startAt')
  const startAt = startAtParam ? Number(startAtParam) : undefined

  if (!matchId) {
    return new Response('Missing matchId', { status: 400 })
  }

  const encoder = new TextEncoder()
  let controls: ReplayControls | null = null

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          // Stream might be closed
        }
      }

      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`))
        } catch {
          // Stream might be closed
        }
      }, 30_000)

      try {
        // Resolve fixture orientation for team names to check shocks
        const orientation = await getFixtureOrientation(matchId)
        
        controls = await startReplay(
          { matchId, speed, startAt },
          {
            onMatchEvent: (event: MatchEvent, state: MatchState) => {
              send('event', { event, state })
            },
            onOddsEvent: (event: OddsEvent) => {
              send('odds', event)

              // Run shock detection on odds update in replay mode — identical
              // pipeline to the live relay, including the AI explanation.
              const shock = detectShock(event, {
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
              send('error', { message: err.message })
            },
            onReconnect: () => {
              // Not applicable to replay
            }
          }
        )
      } catch (err) {
        send('error', { message: err instanceof Error ? err.message : String(err) })
        clearInterval(pingInterval)
        try {
          controller.close()
        } catch {
          // Ignore close errors
        }
        return
      }

      request.signal.addEventListener('abort', () => {
        clearInterval(pingInterval)
        if (controls) controls.stop()
      })
    },
    cancel() {
      if (controls) controls.stop()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}

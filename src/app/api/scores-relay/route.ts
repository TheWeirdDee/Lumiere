import { NextRequest } from 'next/server'
import { connectScoresStream } from '@/lib/txline/stream'
import type { MatchEvent, MatchState } from '@/lib/txline/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const matchId = request.nextUrl.searchParams.get('matchId')
  
  const encoder = new TextEncoder()
  let disconnect: (() => void) | null = null
  
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
      
      disconnect = connectScoresStream({
        onMatchEvent: (event: MatchEvent, state: MatchState) => {
          if (matchId && event.matchId !== matchId) return
          
          // Send both the event and the updated match state
          send('event', { event, state })
        },
        onOddsEvent: () => {}, // unused
        onReconnect: () => {
          send('reconnected', {})
        },
        onError: (err) => {
          send('error', { message: err.message })
        }
      })
      
      request.signal.addEventListener('abort', () => {
        clearInterval(pingInterval)
        if (disconnect) disconnect()
      })
    },
    cancel() {
      if (disconnect) disconnect()
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

import { NextRequest } from 'next/server'
import { connectOddsStream } from '@/lib/txline/stream'
import { getFixtureOrientation } from '@/lib/txline/snapshots'
import { detectShock } from '@/lib/shock-detector'
import { saveShock, getConfiguredGroups } from '@/lib/supabase'
import { bot, formatShockMessage } from '@/lib/telegram-bot'
import { generateExplanation } from '@/lib/ai-explain'
import type { OddsEvent } from '@/lib/txline/types'

/** Shocks at or above this move get broadcast to configured Telegram groups. */
const BIG_SHOCK_THRESHOLD = 0.20

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
      
      // Keep-alive ping every 30s
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`))
        } catch {
          // Stream might be closed
        }
      }, 30_000)
      
      disconnect = connectOddsStream({
        onOddsEvent: (event: OddsEvent) => {
          if (matchId && event.matchId !== matchId) return
          
          // Send normal odds update
          send('odds', event)
          
          // Check for shock asynchronously (detached from the main stream loop —
          // does not block subsequent odds ticks for this or other matches).
          void (async () => {
            try {
              const orientation = await getFixtureOrientation(event.matchId)
              const shock = detectShock(event, {
                homeTeam: orientation.homeTeam,
                awayTeam: orientation.awayTeam,
              })
              if (shock) {
                shock.explanation = await generateExplanation(shock)
                send('shock', shock)
                await saveShock(shock)

                if (Math.abs(shock.delta) >= BIG_SHOCK_THRESHOLD) {
                  try {
                    const groups = await getConfiguredGroups(shock.matchId)
                    for (const chatId of groups) {
                      await bot.telegram.sendMessage(chatId, formatShockMessage(shock))
                    }
                  } catch (tgErr) {
                    console.error('Error broadcasting shock alerts to Telegram:', tgErr)
                  }
                }
              }
            } catch (err) {
              console.error('Error handling odds update shock detection:', err)
            }
          })()
        },
        onMatchEvent: () => {}, // unused in odds stream
        onReconnect: () => {
          send('reconnected', {})
        },
        onError: (err) => {
          send('error', { message: err.message })
        }
      })
      
      // Clean up when connection closes
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

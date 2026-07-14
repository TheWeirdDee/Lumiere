import { NextRequest, NextResponse } from 'next/server'
import { bot } from '@/lib/telegram-bot'

export async function POST(request: NextRequest) {
  // Verify secret token if webhook secret is configured
  const secret = request.headers.get('x-telegram-bot-api-secret-token')
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const body = await request.json()
    await bot.handleUpdate(body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error processing Telegram bot webhook update:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

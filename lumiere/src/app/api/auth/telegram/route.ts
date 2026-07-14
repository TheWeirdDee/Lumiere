import { NextRequest, NextResponse } from 'next/server'
import { supabase as supabaseAdmin } from '@/lib/supabase'
import { verifyTelegramLogin, type TelegramLoginPayload } from '@/lib/telegram-auth'

/**
 * Bridges a verified Telegram Login Widget payload into a real Supabase Auth
 * session. Supabase has no native 'telegram' OAuth provider, so this mints a
 * one-time magic-link token for a synthetic email deterministically tied to
 * the Telegram ID; the client completes the session with
 * `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })`.
 */
export async function POST(request: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return NextResponse.json({ error: 'Telegram login is not configured' }, { status: 500 })
  }

  let payload: TelegramLoginPayload
  try {
    payload = (await request.json()) as TelegramLoginPayload
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!verifyTelegramLogin(payload, botToken)) {
    return NextResponse.json({ error: 'Invalid or expired Telegram login payload' }, { status: 401 })
  }

  const email = `tg-${payload.id}@telegram.lumiere.internal`

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      data: {
        telegram_id: String(payload.id),
        telegram_username: payload.username ?? null,
        telegram_first_name: payload.first_name,
      },
    },
  })

  if (error || !data.properties?.hashed_token) {
    return NextResponse.json({ error: error?.message || 'Failed to create session' }, { status: 500 })
  }

  return NextResponse.json({ tokenHash: data.properties.hashed_token })
}

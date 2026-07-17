import { NextRequest, NextResponse } from 'next/server'
import { verifyTelegramLoginCode } from '@/lib/telegram-code-auth'
import { createTelegramSession } from '@/lib/telegram-session'

const NONCE_COOKIE = 'lumiere_tg_nonce'

export async function POST(request: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return NextResponse.json(
      { error: 'Telegram bot login is not configured' },
      { status: 500 }
    )
  }

  let code: string
  try {
    const body = (await request.json()) as { code?: unknown }
    code = typeof body.code === 'string' ? body.code : ''
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const claims = verifyTelegramLoginCode(code, botToken)
  const expectedNonce = request.cookies.get(NONCE_COOKIE)?.value
  if (!claims || !expectedNonce || claims.nonce !== expectedNonce) {
    return NextResponse.json(
      { error: 'Invalid or expired Telegram login code. Request a new code and try again.' },
      { status: 401 }
    )
  }

  try {
    const session = await createTelegramSession({
      id: claims.id,
      firstName: claims.firstName,
      username: claims.username,
    })
    const response = NextResponse.json(session)
    response.cookies.set(NONCE_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
    return response
  } catch (error) {
    console.error('Failed to create Telegram code session:', error)
    return NextResponse.json(
      { error: 'Could not start your Lumiere session' },
      { status: 500 }
    )
  }
}

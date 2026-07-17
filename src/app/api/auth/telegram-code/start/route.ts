import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'

const NONCE_COOKIE = 'lumiere_tg_nonce'

export async function GET() {
  const username = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, '')
  if (!username) {
    return NextResponse.json(
      { error: 'Telegram bot login is not configured' },
      { status: 500 }
    )
  }

  const nonce = randomBytes(18).toString('base64url')
  const response = NextResponse.json({
    botUrl: `https://t.me/${username}?start=login_${nonce}`,
  })
  response.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

/**
 * Verifies the payload returned by the Telegram Login Widget.
 *
 * Supabase Auth has no native 'telegram' OAuth provider, so login is not
 * `signInWithOAuth({ provider: 'telegram' })` — it is Telegram's own Login
 * Widget, verified here per Telegram's documented algorithm:
 * https://core.telegram.org/widgets/login#checking-authorization
 *
 *   secret_key = SHA256(bot_token)
 *   data_check_string = sorted "key=value" pairs (excluding hash), joined by \n
 *   valid if HMAC-SHA256(data_check_string, secret_key) === hash
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export interface TelegramLoginPayload {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60

export function verifyTelegramLogin(payload: TelegramLoginPayload, botToken: string): boolean {
  const { hash, ...fields } = payload
  if (!hash) return false

  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${String(fields[key as keyof typeof fields])}`)
    .join('\n')

  const secretKey = createHash('sha256').update(botToken).digest()
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  const a = Buffer.from(computedHash, 'hex')
  const b = Buffer.from(hash, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false

  const ageSeconds = Date.now() / 1000 - payload.auth_date
  return ageSeconds >= 0 && ageSeconds < MAX_AUTH_AGE_SECONDS
}

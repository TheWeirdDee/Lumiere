import { createHmac, timingSafeEqual } from 'node:crypto'

const CODE_PREFIX = 'LUM1'
const MAX_CODE_AGE_SECONDS = 10 * 60

export interface TelegramCodeClaims {
  id: number
  firstName: string
  username?: string
  nonce: string
  issuedAt: number
}

function signatureFor(body: string, botToken: string): string {
  return createHmac('sha256', botToken)
    .update(`lumiere-telegram-login.${body}`)
    .digest('base64url')
}

export function createTelegramLoginCode(
  claims: TelegramCodeClaims,
  botToken: string
): string {
  const body = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url')
  return `${CODE_PREFIX}.${body}.${signatureFor(body, botToken)}`
}

export function verifyTelegramLoginCode(
  rawCode: string,
  botToken: string
): TelegramCodeClaims | null {
  const code = rawCode.replace(/\s/g, '')
  const [prefix, body, signature, ...extra] = code.split('.')
  if (prefix !== CODE_PREFIX || !body || !signature || extra.length > 0) return null

  const expected = signatureFor(body, botToken)
  const actualBytes = Buffer.from(signature)
  const expectedBytes = Buffer.from(expected)
  if (
    actualBytes.length !== expectedBytes.length ||
    !timingSafeEqual(actualBytes, expectedBytes)
  ) {
    return null
  }

  try {
    const claims = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as Partial<TelegramCodeClaims>
    const age = Math.floor(Date.now() / 1000) - Number(claims.issuedAt)
    if (
      !Number.isSafeInteger(claims.id) ||
      Number(claims.id) <= 0 ||
      typeof claims.firstName !== 'string' ||
      claims.firstName.length === 0 ||
      (claims.username !== undefined && typeof claims.username !== 'string') ||
      typeof claims.nonce !== 'string' ||
      !/^[A-Za-z0-9_-]{20,64}$/.test(claims.nonce) ||
      !Number.isFinite(claims.issuedAt) ||
      age < -60 ||
      age > MAX_CODE_AGE_SECONDS
    ) {
      return null
    }
    return claims as TelegramCodeClaims
  } catch {
    return null
  }
}

import assert from 'node:assert/strict'
import { createTelegramLoginCode, verifyTelegramLoginCode } from '../src/lib/telegram-code-auth'

const secret = '123456:test-token'
const claims = {
  id: 123456,
  firstName: 'Test',
  username: 'test_user',
  nonce: 'abcdefghijklmnopqrstuvwx',
  issuedAt: Math.floor(Date.now() / 1000),
}
const code = createTelegramLoginCode(claims, secret)
assert.deepEqual(verifyTelegramLoginCode(code, secret), claims)
assert.equal(verifyTelegramLoginCode(`${code.slice(0, -1)}x`, secret), null)
assert.equal(verifyTelegramLoginCode(code, `${secret}-wrong`), null)

const expired = createTelegramLoginCode({ ...claims, issuedAt: claims.issuedAt - 601 }, secret)
assert.equal(verifyTelegramLoginCode(expired, secret), null)

console.log('Telegram login-code signature tests passed')

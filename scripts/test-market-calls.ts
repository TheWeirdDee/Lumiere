import assert from 'node:assert/strict'
import { resolveMarketCall } from '../src/lib/market-call-rules'

const followed = resolveMarketCall('follow', 0.24, 0.39, 0.34)
assert.equal(followed.status, 'won')
assert.equal(followed.iqDelta, 10)
assert.ok(Math.abs(followed.retention - 2 / 3) < 0.000001)

const followedByFade = resolveMarketCall('fade', 0.24, 0.39, 0.34)
assert.equal(followedByFade.status, 'lost')
assert.equal(followedByFade.iqDelta, -5)

const faded = resolveMarketCall('fade', 0.24, 0.39, 0.29)
assert.equal(faded.status, 'won')
assert.equal(faded.iqDelta, 10)

const push = resolveMarketCall('follow', 0.24, 0.39, 0.315)
assert.equal(push.status, 'push')
assert.equal(push.iqDelta, 0)

const fallingMove = resolveMarketCall('follow', 0.6, 0.4, 0.45)
assert.equal(fallingMove.status, 'won')
assert.ok(Math.abs(fallingMove.retention - 0.75) < 0.000001)

console.log('Follow/Fade rule tests passed')


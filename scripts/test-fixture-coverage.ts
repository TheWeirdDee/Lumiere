import assert from 'node:assert/strict'
import { getFixtures } from '../src/lib/txline/snapshots'

async function main() {
  const fixtures = await getFixtures()
  const ids = new Set(fixtures.map((fixture) => fixture.matchId))
  assert.equal(ids.size, fixtures.length, 'Fixture snapshot contains duplicate match IDs')
  assert.ok(fixtures.length >= 104, `Expected all 104 World Cup matches, received ${fixtures.length}`)
  console.log(JSON.stringify({ fixtures: fixtures.length, uniqueMatchIds: ids.size }, null, 2))
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

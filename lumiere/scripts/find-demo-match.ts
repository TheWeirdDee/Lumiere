// scripts/find-demo-match.ts
// Run: npx tsx --env-file=.env.local scripts/find-demo-match.ts

import { getFixtures, getOddsHistory } from '../src/lib/txline/snapshots'
import { detectShock, resetDetector } from '../src/lib/shock-detector'

async function findDemoMatch() {
  console.log('Fetching World Cup fixtures...')
  const fixtures = await getFixtures()
  const now = Date.now()
  const completed = fixtures.filter(f => f.kickoff < now - 4 * 3600_000)
  
  console.log(`Found ${completed.length} completed matches to analyze.`)
  
  const results = []
  
  for (const match of completed) {
    console.log(`Analyzing ${match.homeTeam} vs ${match.awayTeam} (ID: ${match.matchId})...`)
    try {
      const odds = await getOddsHistory(match.matchId)
      resetDetector(match.matchId)
      
      let shockCount = 0
      for (const update of odds) {
        const shock = detectShock(update, {
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam
        })
        if (shock) {
          shockCount++
        }
      }
      
      results.push({
        matchId: match.matchId,
        teams: `${match.homeTeam} vs ${match.awayTeam}`,
        shocks: shockCount,
        oddsCount: odds.length
      })
    } catch (e) {
      console.log(`Failed to analyze match ${match.matchId}:`, e instanceof Error ? e.message : String(e))
    }
  }
  
  results.sort((a, b) => b.shocks - a.shocks)
  
  console.log('\n--- TOP MATCHES BY SHOCKS ---')
  results.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.teams} (ID: ${r.matchId}) — ${r.shocks} shocks (${r.oddsCount} odds updates)`)
  })
  
  if (results.length > 0) {
    console.log(`\nRecommended Demo Match ID: ${results[0].matchId} (${results[0].teams}) with ${results[0].shocks} shocks.`)
  }
}

findDemoMatch().catch(console.error)

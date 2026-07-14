import { NextRequest, NextResponse } from 'next/server'
import { getCachedMatch, cacheMatch } from '@/lib/supabase'
import { getScoresRecordsRaw, getOddsRecordsRaw, getFixtureOrientation } from '@/lib/txline/snapshots'

interface RouteParams {
  params: Promise<{ matchId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { matchId } = await params
  
  try {
    // 1. Check Supabase cache first
    const cached = await getCachedMatch(matchId)
    if (cached) {
      return NextResponse.json({
        matchId,
        homeTeam: cached.home_team,
        awayTeam: cached.away_team,
        matchDate: cached.match_date,
        oddsHistory: cached.odds_history,
        scoresHistory: cached.events,
        shockCount: 0,
        source: 'cache'
      })
    }
    
    // 2. Cache miss: Fetch raw history records from TxLINE
    const [scores, odds, orientation] = await Promise.all([
      getScoresRecordsRaw(matchId),
      getOddsRecordsRaw(matchId),
      getFixtureOrientation(matchId),
    ])
    
    const matchDate = orientation.kickoff 
      ? new Date(orientation.kickoff).toISOString() 
      : new Date().toISOString()
      
    // Save to Supabase cache
    await cacheMatch(matchId, {
      homeTeam: orientation.homeTeam,
      awayTeam: orientation.awayTeam,
      matchDate,
      oddsHistory: odds,
      scoresHistory: scores,
      shockCount: 0 // Will be computed by the replay or scanned separately
    })
    
    return NextResponse.json({
      matchId,
      homeTeam: orientation.homeTeam,
      awayTeam: orientation.awayTeam,
      matchDate,
      oddsHistory: odds,
      scoresHistory: scores,
      shockCount: 0,
      source: 'txline'
    })
  } catch (err) {
    console.error(`Error in /api/history/${matchId}:`, err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

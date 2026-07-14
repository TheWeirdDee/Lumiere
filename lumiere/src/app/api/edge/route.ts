import { NextRequest, NextResponse } from 'next/server'
import { getOddsSnapshot, getFixtureOrientation } from '@/lib/txline/snapshots'
import { MATCH_WINNER_MARKET } from '@/lib/txline/normalize'
import { calculateEdge } from '@/lib/edge-calculator'
import type { SelectionType } from '@/types'

interface EdgeRequestBody {
  matchId: string
  selectionType: SelectionType
  platformOdds: number
}

export async function POST(request: NextRequest) {
  try {
    const { matchId, selectionType, platformOdds } = (await request.json()) as EdgeRequestBody

    if (!matchId || !selectionType || !platformOdds || platformOdds <= 1.0) {
      return NextResponse.json({ error: 'matchId, selectionType, and platformOdds (> 1.0) are required' }, { status: 400 })
    }

    if (selectionType !== 'home_win' && selectionType !== 'away_win' && selectionType !== 'draw') {
      // Verified against real fetched TxLINE data (data/replay-cache/*.json):
      // every cached match carries only the 1X2_PARTICIPANT_RESULT market.
      // Over/Under and BTTS field names are unverified — reporting "not
      // available" honestly rather than guessing SuperOddsType values.
      return NextResponse.json({
        edge: null,
        txlineProb: null,
        available: false,
        reason: 'Live TxLINE odds for this market are not available yet — only Match Winner is currently scored.',
      })
    }

    const [snapshot, orientation] = await Promise.all([getOddsSnapshot(matchId), getFixtureOrientation(matchId)])
    const market = snapshot.markets.find((m) => m.market === MATCH_WINNER_MARKET)

    if (!market) {
      return NextResponse.json({ edge: null, txlineProb: null, available: false, reason: 'No live odds for this match yet.' })
    }

    const txlineProb = selectionType === 'home_win' ? market.homeProb : selectionType === 'away_win' ? market.awayProb : market.drawProb
    const edge = calculateEdge(txlineProb, platformOdds)

    return NextResponse.json({
      edge,
      txlineProb,
      available: true,
      homeTeam: orientation.homeTeam,
      awayTeam: orientation.awayTeam,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

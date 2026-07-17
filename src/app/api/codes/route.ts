import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { supabase as supabaseAdmin } from '@/lib/supabase'
import { calculateCodeEdge } from '@/lib/edge-calculator'
import type { Selection, Platform } from '@/types'
import { calculateEdge } from '@/lib/edge-calculator'
import { getFixtureOrientation, getOddsSnapshot } from '@/lib/txline/snapshots'
import { MATCH_WINNER_MARKET } from '@/lib/txline/normalize'

export async function GET() {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('lumiere_codes')
    .select('*')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ codes: data })
}

interface CreateCodeBody {
  platform: Platform
  platformCode?: string
  selections: Selection[]
}

const ALLOWED_PLATFORMS = new Set<Platform>(['sportybet', 'bet9ja', '1xbet', '247bet', 'other'])
const VERIFIED_SELECTIONS = new Set(['home_win', 'away_win', 'draw'])

async function verifySelection(input: Selection): Promise<Selection> {
  if (!input || typeof input.matchId !== 'string' || !VERIFIED_SELECTIONS.has(input.selectionType)) {
    throw new Error('Only TxLINE-verified Match Winner selections can be added right now')
  }
  const platformOdds = Number(input.platformOdds)
  if (!Number.isFinite(platformOdds) || platformOdds <= 1 || platformOdds > 1000) {
    throw new Error('Every selection needs valid decimal odds greater than 1.0')
  }

  const [snapshot, orientation] = await Promise.all([
    getOddsSnapshot(input.matchId),
    getFixtureOrientation(input.matchId),
  ])
  const market = snapshot.markets.find((item) => item.market === MATCH_WINNER_MARKET)
  if (!market) throw new Error(`TxLINE Match Winner odds are not open for ${orientation.homeTeam} vs ${orientation.awayTeam}`)

  const txlineProb =
    input.selectionType === 'home_win'
      ? market.homeProb
      : input.selectionType === 'away_win'
        ? market.awayProb
        : market.drawProb
  const platformProb = 1 / platformOdds
  return {
    matchId: input.matchId,
    homeTeam: orientation.homeTeam,
    awayTeam: orientation.awayTeam,
    selectionType: input.selectionType,
    platformOdds,
    platformProb,
    txlineProb,
    edge: calculateEdge(txlineProb, platformOdds),
    edgeVerified: true,
    fromShock: Boolean(input.fromShock),
    shockId: typeof input.shockId === 'string' ? input.shockId : undefined,
    status: 'pending',
  }
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('lumiere_users')
    .select('username, total_codes')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Complete your profile first' }, { status: 400 })

  const body = (await request.json()) as CreateCodeBody
  if (!body.selections || body.selections.length === 0 || body.selections.length > 10) {
    return NextResponse.json({ error: 'A code needs 1-10 selections' }, { status: 400 })
  }
  if (!body.platform) {
    return NextResponse.json({ error: 'A platform is required' }, { status: 400 })
  }
  if (!ALLOWED_PLATFORMS.has(body.platform)) {
    return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 })
  }

  let verifiedSelections: Selection[]
  try {
    verifiedSelections = await Promise.all(body.selections.map(verifySelection))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not verify selections against TxLINE' },
      { status: 400 }
    )
  }

  const lumiereCode = `LM-${profile.username}-${Date.now()}`
  const overallEdge = calculateCodeEdge(verifiedSelections)

  const { data: code, error } = await supabaseAdmin
    .from('lumiere_codes')
    .insert({
      creator_id: user.id,
      creator_username: profile.username,
      platform: body.platform,
      platform_code: body.platformCode || null,
      lumiere_code: lumiereCode,
      selections: verifiedSelections,
      overall_edge: overallEdge,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const selectionRows = verifiedSelections.map((s) => ({
    code_id: code.id,
    match_id: s.matchId,
    home_team: s.homeTeam,
    away_team: s.awayTeam,
    selection_type: s.selectionType,
    platform_odds: s.platformOdds,
    txline_prob: s.txlineProb,
    platform_prob: s.platformProb,
    edge: s.edge,
    edge_verified: true,
    from_shock: s.fromShock,
    shock_id: s.shockId || null,
    status: 'pending',
  }))

  const { error: selErr } = await supabaseAdmin.from('lumiere_selections').insert(selectionRows)
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 })

  const { error: statError } = await supabaseAdmin.rpc('increment_user_stat', {
    p_user_id: user.id,
    p_stat: 'total_codes',
  })
  if (statError) console.error('Could not increment total_codes:', statError)

  return NextResponse.json({ code })
}

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { supabase as supabaseAdmin } from '@/lib/supabase'
import { calculateCodeEdge } from '@/lib/edge-calculator'
import type { Selection, Platform } from '@/types'

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

  const lumiereCode = `LM-${profile.username}-${Date.now()}`
  const overallEdge = calculateCodeEdge(body.selections)

  const { data: code, error } = await supabaseAdmin
    .from('lumiere_codes')
    .insert({
      creator_id: user.id,
      creator_username: profile.username,
      platform: body.platform,
      platform_code: body.platformCode || null,
      lumiere_code: lumiereCode,
      selections: body.selections,
      overall_edge: overallEdge,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const selectionRows = body.selections.map((s) => ({
    code_id: code.id,
    match_id: s.matchId,
    home_team: s.homeTeam,
    away_team: s.awayTeam,
    selection_type: s.selectionType,
    platform_odds: s.platformOdds,
    txline_prob: s.txlineProb,
    platform_prob: s.platformProb,
    edge: s.edge,
    from_shock: s.fromShock,
    shock_id: s.shockId || null,
    status: 'pending',
  }))

  const { error: selErr } = await supabaseAdmin.from('lumiere_selections').insert(selectionRows)
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 })

  await supabaseAdmin
    .from('lumiere_users')
    .update({ total_codes: (profile.total_codes ?? 0) + 1 })
    .eq('id', user.id)

  return NextResponse.json({ code })
}

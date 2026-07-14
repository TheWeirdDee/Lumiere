import { NextRequest, NextResponse } from 'next/server'
import { supabase as supabaseAdmin } from '@/lib/supabase'
import { getFixtures } from '@/lib/txline/snapshots'
import { updateUserIQ } from '@/lib/market-iq'
import type { SelectionStatus } from '@/types'

interface RouteParams {
  params: Promise<{ codeId: string }>
}

/** Public — no auth. Returns the code, its selections, and live-computed status labels. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { codeId } = await params

  const { data: code, error } = await supabaseAdmin.from('lumiere_codes').select('*').eq('lumiere_code', codeId).maybeSingle()
  if (error || !code) {
    return NextResponse.json({ error: 'Code not found' }, { status: 404 })
  }

  const { data: selections } = await supabaseAdmin
    .from('lumiere_selections')
    .select('*')
    .eq('code_id', code.id)
    .order('created_at', { ascending: true })

  void supabaseAdmin
    .from('lumiere_codes')
    .update({ view_count: (code.view_count ?? 0) + 1 })
    .eq('id', code.id)
    .then(() => undefined)

  const fixtures = await getFixtures().catch(() => [])
  const byMatchId = new Map(fixtures.map((f) => [f.matchId, f]))

  const withLiveLabel = (selections || []).map((s) => {
    if (s.status !== 'pending') return { ...s, liveLabel: s.status as SelectionStatus }
    const fixture = byMatchId.get(s.match_id)
    const isLive = fixture && fixture.phase !== 'NS' && fixture.phase !== 'P' && !['F', 'FET', 'FPE', 'C'].includes(fixture.phase)
    return {
      ...s,
      liveLabel: isLive ? 'live' : 'pending',
      liveScore: isLive ? { home: fixture?.homeScore ?? 0, away: fixture?.awayScore ?? 0 } : null,
    }
  })

  return NextResponse.json({ code, selections: withLiveLabel })
}

interface PatchBody {
  selectionId: string
  status: 'won' | 'lost' | 'void'
  matchResult?: string
}

/** Settles one selection, then — once every selection in the code is terminal — resolves the code and updates the creator's Market IQ. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { codeId } = await params
  const body = (await request.json()) as PatchBody

  const { data: code, error: codeErr } = await supabaseAdmin.from('lumiere_codes').select('*').eq('lumiere_code', codeId).maybeSingle()
  if (codeErr || !code) {
    return NextResponse.json({ error: 'Code not found' }, { status: 404 })
  }

  const { error: updateErr } = await supabaseAdmin
    .from('lumiere_selections')
    .update({ status: body.status, match_result: body.matchResult || null })
    .eq('id', body.selectionId)
    .eq('code_id', code.id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  const { data: selections } = await supabaseAdmin.from('lumiere_selections').select('*').eq('code_id', code.id)
  const allTerminal = (selections || []).every((s) => s.status === 'won' || s.status === 'lost' || s.status === 'void')

  if (allTerminal && code.status !== 'won' && code.status !== 'lost' && code.status !== 'partial') {
    const scored = (selections || []).filter((s) => s.status === 'won' || s.status === 'lost')
    const allWon = scored.length > 0 && scored.every((s) => s.status === 'won')
    const anyWon = scored.some((s) => s.status === 'won')
    const overallStatus = scored.length === 0 ? 'void' : allWon ? 'won' : anyWon ? 'partial' : 'lost'

    await supabaseAdmin
      .from('lumiere_codes')
      .update({ status: overallStatus, resolved_at: new Date().toISOString() })
      .eq('id', code.id)

    for (const s of scored) {
      await updateUserIQ(code.creator_id, Number(s.edge) > 0, s.status === 'won', supabaseAdmin)
    }

    if (overallStatus === 'won') {
      const { data: creator } = await supabaseAdmin.from('lumiere_users').select('winning_codes').eq('id', code.creator_id).maybeSingle()
      await supabaseAdmin
        .from('lumiere_users')
        .update({ winning_codes: (creator?.winning_codes ?? 0) + 1 })
        .eq('id', code.creator_id)
    }
  }

  return NextResponse.json({ ok: true })
}

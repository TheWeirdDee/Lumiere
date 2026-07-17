import { NextRequest, NextResponse } from 'next/server'
import { supabase as supabaseAdmin } from '@/lib/supabase'
import { getFixtures, getScoresSnapshot } from '@/lib/txline/snapshots'
import { settleCodesForMatch } from '@/lib/code-settlement'
import type { SelectionStatus } from '@/types'

interface RouteParams {
  params: Promise<{ codeId: string }>
}

/** Public read. A browser counts as one view even though the page polls. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { codeId } = await params
  const { data: initialCode, error } = await supabaseAdmin
    .from('lumiere_codes')
    .select('*')
    .eq('lumiere_code', codeId)
    .maybeSingle()
  if (error || !initialCode) return NextResponse.json({ error: 'Code not found' }, { status: 404 })
  let code = initialCode

  let { data: selections } = await supabaseAdmin
    .from('lumiere_selections')
    .select('*')
    .eq('code_id', code.id)
    .order('created_at', { ascending: true })

  const fixtures = await getFixtures().catch(() => [])
  const byMatchId = new Map(fixtures.map((fixture) => [fixture.matchId, fixture]))
  const completedPendingMatches = [...new Set((selections || [])
    .filter((selection) => selection.status === 'pending' && ['F', 'FET', 'FPE', 'A', 'C', 'TXCC'].includes(byMatchId.get(selection.match_id)?.phase || ''))
    .map((selection) => selection.match_id))]
  if (completedPendingMatches.length > 0) {
    await Promise.all(completedPendingMatches.map(async (matchId) => {
      const snapshot = await getScoresSnapshot(matchId)
      await settleCodesForMatch(snapshot.state)
    })).catch((settleError) => console.error('Could not refresh code settlement:', settleError))
    const [{ data: refreshedCode }, { data: refreshedSelections }] = await Promise.all([
      supabaseAdmin.from('lumiere_codes').select('*').eq('id', code.id).maybeSingle(),
      supabaseAdmin.from('lumiere_selections').select('*').eq('code_id', code.id).order('created_at', { ascending: true }),
    ])
    if (refreshedCode) code = refreshedCode
    if (refreshedSelections) selections = refreshedSelections
  }
  const withLiveLabel = (selections || []).map((selection) => {
    if (selection.status !== 'pending') {
      return { ...selection, liveLabel: selection.status as SelectionStatus }
    }
    const fixture = byMatchId.get(selection.match_id)
    const isLive = fixture && fixture.phase !== 'NS' && fixture.phase !== 'P' && !['F', 'FET', 'FPE', 'C'].includes(fixture.phase)
    return {
      ...selection,
      liveLabel: isLive ? 'live' : 'pending',
      liveScore: isLive ? { home: fixture?.homeScore ?? 0, away: fixture?.awayScore ?? 0 } : null,
    }
  })

  const response = NextResponse.json(
    { code, selections: withLiveLabel },
    { headers: { 'Cache-Control': 'no-store' } }
  )
  const viewCookie = `lumiere_view_${code.id}`
  if (!request.cookies.has(viewCookie)) {
    const { error: metricError } = await supabaseAdmin.rpc('increment_code_metric', {
      p_lumiere_code: codeId,
      p_metric: 'view',
    })
    if (metricError) console.error('Could not increment code view:', metricError)
    response.cookies.set(viewCookie, '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })
  }
  return response
}

/** Counts a genuine share once per browser. Settlement is intentionally absent
 * from this public API; only the TxLINE score resolver may change outcomes. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { codeId } = await params
  const { data: code, error } = await supabaseAdmin
    .from('lumiere_codes')
    .select('id')
    .eq('lumiere_code', codeId)
    .maybeSingle()
  if (error || !code) return NextResponse.json({ error: 'Code not found' }, { status: 404 })

  const shareCookie = `lumiere_share_${code.id}`
  const response = NextResponse.json({ ok: true })
  if (!request.cookies.has(shareCookie)) {
    const { error: metricError } = await supabaseAdmin.rpc('increment_code_metric', {
      p_lumiere_code: codeId,
      p_metric: 'share',
    })
    if (metricError) return NextResponse.json({ error: metricError.message }, { status: 500 })
    response.cookies.set(shareCookie, '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })
  }
  return response
}

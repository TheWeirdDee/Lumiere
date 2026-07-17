import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(request: NextRequest): boolean {
  const expected = process.env.LUMIERE_DATA_EXPORT_SECRET
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!expected) return false
  const suppliedBytes = Buffer.from(supplied)
  const expectedBytes = Buffer.from(expected)
  if (suppliedBytes.length !== expectedBytes.length) return false
  return timingSafeEqual(suppliedBytes, expectedBytes)
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: shocks, error: shockError }, { data: calls, error: callError }, { data: selections, error: selectionError }] = await Promise.all([
    supabase.from('lumiere_shocks').select('match_id, affected_team, direction, delta, window_seconds, pre_prob, post_prob, fired_at'),
    supabase.from('lumiere_market_calls').select('match_id, choice, affected_team, pre_prob, post_prob, resolved_prob, retention, status, verified, created_at, resolved_at'),
    supabase.from('lumiere_selections').select('match_id, selection_type, platform_odds, txline_prob, platform_prob, edge, edge_verified, status, match_result, created_at'),
  ])
  const error = shockError ?? callError ?? selectionError
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    source: 'LUMIERE normalized TxLINE World Cup market intelligence',
    shocks: shocks ?? [],
    marketCalls: calls ?? [],
    selections: selections ?? [],
  }, { headers: { 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="lumiere-market-intelligence.json"' } })
}

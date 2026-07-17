import 'server-only'
import type { OddsEvent } from '@/lib/txline/types'
import type { MarketCall, MarketCallChoice } from '@/types'
import { supabase } from '@/lib/supabase'
import {
  MARKET_CALL_HORIZON_MS,
  MARKET_CALL_WINDOW_MS,
  resolveMarketCall,
} from '@/lib/market-call-rules'
import { getOddsSnapshot } from '@/lib/txline/snapshots'
import { MATCH_WINNER_MARKET } from '@/lib/txline/normalize'

interface ShockRow {
  id: string
  match_id: string
  affected_team: 'home' | 'away'
  pre_prob: number | string
  post_prob: number | string
  fired_at: string
  recorded_at: string
  source: 'live' | 'replay'
}

interface MarketCallRow {
  id: string
  user_id: string
  shock_id: string
  match_id: string
  choice: MarketCallChoice
  affected_team: 'home' | 'away'
  pre_prob: number | string
  post_prob: number | string
  target_event_at: string
  resolved_prob: number | string | null
  retention: number | string | null
  status: MarketCall['status']
  iq_delta: number
  verified: boolean
  created_at: string
  resolved_at: string | null
}

export function mapMarketCall(row: MarketCallRow): MarketCall {
  return {
    id: row.id,
    userId: row.user_id,
    shockId: row.shock_id,
    matchId: row.match_id,
    choice: row.choice,
    affectedTeam: row.affected_team,
    preProb: Number(row.pre_prob),
    postProb: Number(row.post_prob),
    targetEventAt: new Date(row.target_event_at).getTime(),
    resolvedProb: row.resolved_prob === null ? undefined : Number(row.resolved_prob),
    retention: row.retention === null ? undefined : Number(row.retention),
    status: row.status,
    iqDelta: row.iq_delta,
    verified: row.verified,
    createdAt: new Date(row.created_at).getTime(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).getTime() : undefined,
  }
}

export async function createMarketCall(
  userId: string,
  shockId: string,
  choice: MarketCallChoice
): Promise<MarketCall> {
  const { data: shock, error: shockError } = await supabase
    .from('lumiere_shocks')
    .select('id, match_id, affected_team, pre_prob, post_prob, fired_at, recorded_at, source')
    .eq('id', shockId)
    .maybeSingle<ShockRow>()

  if (shockError || !shock) throw new Error('Shock not found')
  if (shock.source !== 'live') throw new Error('Replay shocks are practice only')

  const firedAt = new Date(shock.fired_at).getTime()
  const eventAge = Date.now() - firedAt
  const age = Date.now() - new Date(shock.recorded_at).getTime()
  // Both clocks must be fresh. The recorded-at check enforces the 30-second
  // interaction window; fired-at prevents legacy/migrated rows from becoming
  // eligible merely because the migration just populated recorded_at.
  if (
    !Number.isFinite(firedAt) ||
    eventAge < -10_000 ||
    eventAge > 2 * 60_000 ||
    age < -10_000 ||
    age > MARKET_CALL_WINDOW_MS
  ) {
    throw new Error('This call window has closed')
  }

  const { data, error } = await supabase
    .from('lumiere_market_calls')
    .insert({
      user_id: userId,
      shock_id: shock.id,
      match_id: shock.match_id,
      choice,
      affected_team: shock.affected_team,
      pre_prob: Number(shock.pre_prob),
      post_prob: Number(shock.post_prob),
      target_event_at: new Date(firedAt + MARKET_CALL_HORIZON_MS).toISOString(),
      verified: true,
    })
    .select('*')
    .single<MarketCallRow>()

  if (!error && data) return mapMarketCall(data)

  // The unique user/shock constraint makes retries safe. Return the original
  // call rather than converting a double tap into an error.
  const { data: existing } = await supabase
    .from('lumiere_market_calls')
    .select('*')
    .eq('user_id', userId)
    .eq('shock_id', shockId)
    .maybeSingle<MarketCallRow>()
  if (existing) return mapMarketCall(existing)
  throw error ?? new Error('Could not save market call')
}

export async function getUserMarketCalls(
  userId: string,
  filters: { matchId?: string; shockId?: string } = {}
): Promise<MarketCall[]> {
  let query = supabase
    .from('lumiere_market_calls')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (filters.matchId) query = query.eq('match_id', filters.matchId)
  if (filters.shockId) query = query.eq('shock_id', filters.shockId)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as MarketCallRow[]).map(mapMarketCall)
}

/** Resolve due calls from the first primary TxLINE tick at/after target time. */
export async function resolvePendingMarketCalls(event: OddsEvent): Promise<number> {
  const { data, error } = await supabase
    .from('lumiere_market_calls')
    .select('*')
    .eq('match_id', event.matchId)
    .eq('status', 'pending')
    .lte('target_event_at', new Date(event.timestamp).toISOString())
    .limit(250)
  if (error) throw error

  let resolvedCount = 0
  for (const row of (data ?? []) as MarketCallRow[]) {
    const resolvedProb = row.affected_team === 'home' ? event.homeProb : event.awayProb
    const result = resolveMarketCall(
      row.choice,
      Number(row.pre_prob),
      Number(row.post_prob),
      resolvedProb
    )
    const { data: applied, error: resolveError } = await supabase.rpc('resolve_market_call', {
      p_call_id: row.id,
      p_resolved_prob: resolvedProb,
      p_retention: result.retention,
      p_status: result.status,
      p_iq_delta: result.iqDelta,
      p_event_at: new Date(event.timestamp).toISOString(),
    })
    if (resolveError) throw resolveError
    if (applied) resolvedCount += 1
  }
  return resolvedCount
}

/** Recovery path for a fan who closed the watch page before resolution. */
export async function resolveDueMarketCallsFromSnapshots(): Promise<number> {
  const { data, error } = await supabase
    .from('lumiere_market_calls')
    .select('match_id')
    .eq('status', 'pending')
    .lte('target_event_at', new Date().toISOString())
    .limit(250)
  if (error) throw error

  let resolved = 0
  const matchIds = [...new Set((data ?? []).map((row) => String(row.match_id)))]
  for (const matchId of matchIds) {
    const snapshot = await getOddsSnapshot(matchId)
    const market = snapshot.markets.find((item) => item.market === MATCH_WINNER_MARKET)
    if (!market) continue
    resolved += await resolvePendingMarketCalls({
      matchId,
      timestamp: market.updatedAt || snapshot.timestamp,
      market: MATCH_WINNER_MARKET,
      homeProb: market.homeProb,
      drawProb: market.drawProb,
      awayProb: market.awayProb,
      previousHomeProb: market.homeProb,
      previousDrawProb: market.drawProb,
      previousAwayProb: market.awayProb,
      deltaHome: 0,
      deltaDraw: 0,
      deltaAway: 0,
      raw: snapshot.raw,
    })
  }
  return resolved
}

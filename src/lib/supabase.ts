import { createClient } from '@supabase/supabase-js'
import type { OddsShock } from '../types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function saveShock(shock: OddsShock): Promise<void> {
  const { error } = await supabase.from('lumiere_shocks').insert([{
    match_id: shock.matchId,
    home_team: shock.homeTeam,
    away_team: shock.awayTeam,
    affected_team: shock.affectedTeam,
    direction: shock.direction,
    delta: shock.delta,
    window_seconds: shock.windowSeconds,
    pre_prob: shock.preProb,
    post_prob: shock.postProb,
    trigger_event: shock.triggerEvent || null,
    trigger_minute: shock.triggerMinute || null,
    explanation: shock.explanation || null,
    fired_at: new Date(shock.firedAt).toISOString(),
  }])
  if (error) throw error
}

export async function getShocksForMatch(matchId: string): Promise<OddsShock[]> {
  const { data, error } = await supabase
    .from('lumiere_shocks')
    .select('*')
    .eq('match_id', matchId)
    .order('fired_at', { ascending: true })
  if (error) throw error
  return (data || []).map(row => ({
    id: row.id,
    matchId: row.match_id,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    affectedTeam: row.affected_team as 'home' | 'away',
    direction: row.direction as 'up' | 'down',
    delta: Number(row.delta),
    windowSeconds: row.window_seconds,
    preProb: Number(row.pre_prob),
    postProb: Number(row.post_prob),
    triggerEvent: row.trigger_event || undefined,
    triggerMinute: row.trigger_minute || undefined,
    explanation: row.explanation || undefined,
    firedAt: new Date(row.fired_at).getTime(),
  }))
}

export async function cacheMatch(matchId: string, data: {
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  oddsHistory: unknown;
  scoresHistory: unknown;
  shockCount: number;
}): Promise<void> {
  const { error } = await supabase.from('lumiere_match_cache').upsert([{
    match_id: matchId,
    home_team: data.homeTeam,
    away_team: data.awayTeam,
    match_date: data.matchDate,
    odds_history: data.oddsHistory,
    events: data.scoresHistory,
  }])
  if (error) throw error
}

export async function getCachedMatch(matchId: string) {
  const { data, error } = await supabase
    .from('lumiere_match_cache')
    .select('*')
    .eq('match_id', matchId)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function getConfiguredGroups(matchId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('lumiere_telegram_groups')
      .select('chat_id')
      .eq('match_id', matchId)
    if (error) return []
    return (data || []).map(row => String(row.chat_id))
  } catch (e) {
    return []
  }
}

export { supabase }

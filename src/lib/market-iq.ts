import type { SupabaseClient } from '@supabase/supabase-js'

export function calculateIQDelta(hadEdge: boolean, won: boolean): number {
  if (hadEdge && won) return 15 // smart call, correct outcome
  if (hadEdge && !won) return 5 // smart call, bad luck
  if (!hadEdge && won) return -5 // lucky, not smart
  return -10 // bad call, bad outcome
}

/** Atomically bumps a user's Market IQ via the increment_market_iq SQL function (schema.sql). */
export async function updateUserIQ(
  userId: string,
  hadEdge: boolean,
  won: boolean,
  supabaseAdmin: SupabaseClient
): Promise<void> {
  const delta = calculateIQDelta(hadEdge, won)
  const { error } = await supabaseAdmin.rpc('increment_market_iq', { p_user_id: userId, p_delta: delta })
  if (error) throw error
}

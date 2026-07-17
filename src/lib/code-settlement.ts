import 'server-only'
import type { MatchState } from '@/lib/txline/types'
import type { SelectionType } from '@/types'
import { supabase } from '@/lib/supabase'
import { calculateIQDelta } from '@/lib/market-iq'
import { bot } from '@/lib/telegram-bot'

const FINAL_PHASES = new Set(['F', 'FET', 'FPE'])
const VOID_PHASES = new Set(['A', 'C', 'TXCC'])

interface SelectionRow {
  id: string
  code_id: string
  selection_type: SelectionType
  status: 'pending' | 'won' | 'lost' | 'void'
  edge: number | string
  edge_verified?: boolean
}

function selectionResult(
  selectionType: SelectionType,
  homeScore: number,
  awayScore: number
): 'won' | 'lost' {
  switch (selectionType) {
    case 'home_win':
      return homeScore > awayScore ? 'won' : 'lost'
    case 'away_win':
      return awayScore > homeScore ? 'won' : 'lost'
    case 'draw':
      return homeScore === awayScore ? 'won' : 'lost'
    case 'over_2.5':
      return homeScore + awayScore > 2.5 ? 'won' : 'lost'
    case 'under_2.5':
      return homeScore + awayScore < 2.5 ? 'won' : 'lost'
    case 'btts_yes':
      return homeScore > 0 && awayScore > 0 ? 'won' : 'lost'
    case 'btts_no':
      return homeScore === 0 || awayScore === 0 ? 'won' : 'lost'
  }
}

/**
 * Server-owned, idempotent settlement from a final TxLINE score state. Public
 * callers never choose outcomes; they only observe the resulting code status.
 */
export async function settleCodesForMatch(state: MatchState): Promise<number> {
  if (!FINAL_PHASES.has(state.phase) && !VOID_PHASES.has(state.phase)) return 0

  const { data: pending, error: pendingError } = await supabase
    .from('lumiere_selections')
    .select('id, code_id, selection_type, status, edge, edge_verified')
    .eq('match_id', state.matchId)
    .eq('status', 'pending')
  if (pendingError) throw pendingError
  if (!pending || pending.length === 0) return 0

  const matchResult = `${state.homeScore}-${state.awayScore}`
  const codeIds = new Set<string>()
  for (const selection of pending as SelectionRow[]) {
    const status = VOID_PHASES.has(state.phase)
      ? 'void'
      : selectionResult(selection.selection_type, state.homeScore, state.awayScore)
    const { error } = await supabase
      .from('lumiere_selections')
      .update({ status, match_result: matchResult })
      .eq('id', selection.id)
      .eq('status', 'pending')
    if (error) throw error
    codeIds.add(selection.code_id)
  }

  let finalized = 0
  for (const codeId of codeIds) {
    const [{ data: code, error: codeError }, { data: selections, error: selectionsError }] = await Promise.all([
      supabase.from('lumiere_codes').select('id, creator_id, creator_username, lumiere_code, status, resolved_at').eq('id', codeId).maybeSingle(),
      supabase.from('lumiere_selections').select('id, status, edge, edge_verified').eq('code_id', codeId),
    ])
    if (codeError || selectionsError) throw codeError ?? selectionsError
    if (!code || !selections || selections.some((item) => item.status === 'pending')) continue

    const scored = (selections as SelectionRow[]).filter((item) => item.status === 'won' || item.status === 'lost')
    const allWon = scored.length > 0 && scored.every((item) => item.status === 'won')
    const anyWon = scored.some((item) => item.status === 'won')
    const overallStatus = scored.length === 0 ? 'void' : allWon ? 'won' : anyWon ? 'partial' : 'lost'
    const resolvedAt = new Date(state.lastUpdated || Date.now()).toISOString()

    const { data: claimed, error: claimError } = await supabase
      .from('lumiere_codes')
      .update({ status: overallStatus, resolved_at: resolvedAt })
      .eq('id', codeId)
      .is('resolved_at', null)
      .select('id')
    if (claimError) throw claimError
    if ((claimed ?? []).length > 0) {
      finalized += 1
      if (overallStatus === 'won') {
        const { error } = await supabase.rpc('increment_user_stat', {
          p_user_id: code.creator_id,
          p_stat: 'winning_codes',
        })
        if (error) throw error
      }
      const { data: watches } = await supabase
        .from('lumiere_telegram_code_watches')
        .select('id, chat_id')
        .eq('code_id', codeId)
      for (const watch of watches ?? []) {
        try {
          await bot.telegram.sendMessage(
            watch.chat_id,
            `LUMIERE CODE RESOLVED\n\n${code.lumiere_code} by @${code.creator_username}\nStatus: ${overallStatus.toUpperCase()}\nFinal match result: ${matchResult}`
          )
          await supabase.from('lumiere_telegram_code_watches').update({ notified_status: overallStatus }).eq('id', watch.id)
        } catch (telegramError) {
          console.error('Could not send Telegram code result:', telegramError)
        }
      }
    }

    // Score only picks whose TxLINE edge was actually verified. The unique IQ
    // event key prevents double awards across reconnects and concurrent relays.
    for (const selection of scored.filter((item) => item.edge_verified)) {
      const won = selection.status === 'won'
      const delta = calculateIQDelta(Number(selection.edge) > 0, won)
      const { error } = await supabase.rpc('apply_market_iq_event', {
        p_user_id: code.creator_id,
        p_source_type: 'code_selection',
        p_source_id: selection.id,
        p_delta: delta,
        p_metadata: { status: selection.status, edge: Number(selection.edge), match_result: matchResult },
      })
      if (error) throw error
    }
  }

  return finalized
}

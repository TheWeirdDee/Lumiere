// Demo-only utility: replays a real recorded match through the actual shock
// detector, picks its single biggest shock, and sends it to every Telegram
// group currently following that match — using the exact same
// formatShockMessage() + bot.telegram.sendMessage() call the live relay uses.
//
// This exists so a demo recording can trigger a Telegram alert on command
// instead of waiting on an unpredictable live shock. The message content is
// real recorded shock data, not fabricated — it's the same alert that fired
// during the actual match, replayed into Telegram for timing purposes.
//
// Usage:
//   1. In the target Telegram group, run: /followmatch <matchId>
//      (this registers the group's chat_id in lumiere_telegram_groups)
//   2. npx tsx --env-file=.env.local scripts/demo-telegram-shock.ts <matchId>

import { createClient } from '@supabase/supabase-js'
import { loadReplayData, startReplay } from '../src/lib/txline/replay'
import { createShockDetector } from '../src/lib/shock-detector'
import { isPrimaryMarket } from '../src/lib/primary-market'
import { generateExplanation } from '../src/lib/ai-explain'
import { bot, formatShockMessage } from '../src/lib/telegram-bot'
import type { OddsEvent } from '../src/lib/txline/types'
import type { OddsShock } from '../src/types'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

async function biggestShock(matchId: string): Promise<OddsShock | null> {
  const cache = await loadReplayData(matchId)
  const kickoff = cache.orientation.kickoff
  if (!kickoff) throw new Error(`Replay ${matchId} has no kickoff timestamp`)
  const detector = createShockDetector()
  let best: OddsShock | null = null

  await startReplay(
    { matchId, speed: 0, startAt: kickoff - 5 * 60_000 },
    {
      onMatchEvent() {},
      onOddsEvent(event: OddsEvent) {
        if (!isPrimaryMarket(event)) return
        const shock = detector.detect(event, { homeTeam: cache.orientation.homeTeam, awayTeam: cache.orientation.awayTeam })
        if (shock && (!best || shock.delta > best.delta)) best = shock
      },
      onError() {},
      onReconnect() {},
      onComplete() {},
    }
  )

  return best
}

async function main() {
  const matchId = process.argv[2] || process.env.NEXT_PUBLIC_DEMO_MATCH_ID || '18202701'

  const { data: groups, error } = await supabase
    .from('lumiere_telegram_groups')
    .select('chat_id')
    .eq('match_id', matchId)

  if (error) throw error
  if (!groups || groups.length === 0) {
    console.error(
      `No Telegram group follows match ${matchId} yet.\n` +
      `Run "/followmatch ${matchId}" inside the target group first, then re-run this script.`
    )
    process.exitCode = 1
    return
  }

  console.log(`Scanning match ${matchId} for its biggest recorded shock...`)
  const shock = await biggestShock(matchId)
  if (!shock) {
    console.error(`No shocks found in the recorded data for match ${matchId}.`)
    process.exitCode = 1
    return
  }

  shock.explanation = await generateExplanation(shock)
  const message = formatShockMessage(shock)

  console.log(`Sending to ${groups.length} group(s):\n\n${message}\n`)
  for (const group of groups) {
    await bot.telegram.sendMessage(group.chat_id as string, message)
  }
  console.log('Done.')
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

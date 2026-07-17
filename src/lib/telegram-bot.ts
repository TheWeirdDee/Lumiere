import { Telegraf } from 'telegraf'
import { supabase } from './supabase'
import { createTelegramLoginCode } from './telegram-code-auth'
import type { OddsShock } from '../types'

const token = process.env.TELEGRAM_BOT_TOKEN

export function formatShockMessage(shock: OddsShock): string {
  const team = shock.affectedTeam === 'home' ? shock.homeTeam : shock.awayTeam
  const arrow = shock.direction === 'down' ? '📉' : '📈'
  return `${arrow} ODDS SHOCK — ${shock.homeTeam} vs ${shock.awayTeam}\n\n` +
    `${team} win probability ${shock.direction === 'down' ? 'dropped' : 'jumped'} ` +
    `${(shock.delta * 100).toFixed(0)}% in ${shock.windowSeconds}s\n\n` +
    `${shock.explanation || ''}\n\n` +
    `Build a code → ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/watch`
}

interface MockBot {
  start: (cb: (ctx: unknown) => void) => void
  command: (cmd: string, cb: (ctx: unknown) => void) => void
  on: (type: string, cb: (ctx: unknown) => void) => void
  handleUpdate: (update: unknown) => Promise<void>
  telegram: { sendMessage: (chatId: string, text: string) => Promise<unknown> }
}

const mockBot: MockBot = {
  start: () => {},
  command: () => {},
  on: () => {},
  handleUpdate: async (update: unknown) => {
    console.log('[MOCK TELEGRAM BOT] handleUpdate:', update)
  },
  telegram: {
    sendMessage: async (chatId: string, text: string) => {
      console.log(`[MOCK TELEGRAM BOT] Sending to ${chatId}: ${text}`)
      return {}
    },
  },
}

export const bot = token ? new Telegraf(token) : (mockBot as unknown as Telegraf)

function appHostnames(): string[] {
  const hosts = ['localhost:3000']
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    try {
      hosts.push(new URL(appUrl).host)
    } catch {
      // ignore malformed URL
    }
  }
  return hosts
}

if (token) {
  bot.start(async (ctx) => {
    if (ctx.startPayload.startsWith('login_')) {
      const nonce = ctx.startPayload.slice('login_'.length)
      const from = ctx.from
      if (!from || !/^[A-Za-z0-9_-]{20,64}$/.test(nonce)) {
        await ctx.reply('This login link is invalid. Return to Lumiere and request a new one.')
        return
      }
      const code = createTelegramLoginCode(
        {
          id: from.id,
          firstName: from.first_name,
          username: from.username,
          nonce,
          issuedAt: Math.floor(Date.now() / 1000),
        },
        token
      )
      await ctx.reply(
        'Your LUMIERE login code is below. Copy the complete code and paste it into the sign-in page.\n\n' +
          `<code>${code}</code>\n\n` +
          'This code expires in 10 minutes and works only in the browser that requested it.',
        { parse_mode: 'HTML' }
      )
      return
    }

    await ctx.reply(
      `👋 Welcome to LUMIÈRE\n\n` +
      `The market intelligence layer for World Cup codes.\n\n` +
      `Share your codes with edge scores. Track performance live.\n\n` +
      `→ ${process.env.NEXT_PUBLIC_APP_URL || 'lumiere.vercel.app'}`
    )
  })

  // /mycode — show user's active codes
  bot.command('mycode', async (ctx) => {
    try {
      const tgId = ctx.from?.id
      if (!tgId) {
        return ctx.reply('Could not identify your Telegram account.')
      }

      const { data: user, error: userErr } = await supabase
        .from('lumiere_users')
        .select('id, username')
        .eq('telegram_id', String(tgId))
        .maybeSingle()

      if (userErr || !user) {
        return ctx.reply('You are not registered yet. Please log in on the website first.')
      }

      const { data: codes, error: codesErr } = await supabase
        .from('lumiere_codes')
        .select('lumiere_code, overall_edge, status')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (codesErr || !codes || codes.length === 0) {
        return ctx.reply(`@${user.username}, you don't have any active selections or shared codes yet.`)
      }

      let resp = `📋 Your Active Codes (@${user.username}):\n\n`
      codes.forEach((c) => {
        const edgePct = c.overall_edge != null ? `${(Number(c.overall_edge) * 100).toFixed(1)}%` : 'n/a'
        resp += `• ${c.lumiere_code} | Edge: ${edgePct} | Status: ${c.status || 'pending'}\n`
      })
      ctx.reply(resp)
    } catch {
      ctx.reply('Failed to fetch active codes. Please try again later.')
    }
  })

  // /shock [team1] [team2] — current market state for a specific match, or recent shocks if no args
  bot.command('shock', async (ctx) => {
    try {
      const text = 'text' in ctx.message ? ctx.message.text : ''
      const args = text.split(' ').slice(1).filter(Boolean)

      let query = supabase
        .from('lumiere_shocks')
        .select('*')
        .order('fired_at', { ascending: false })

      if (args.length > 0) {
        const needle = args.join(' ').toLowerCase()
        query = query.or(`home_team.ilike.%${needle}%,away_team.ilike.%${needle}%`)
      }

      const { data: shocks, error } = await query.limit(3)

      if (error || !shocks || shocks.length === 0) {
        return ctx.reply(
          args.length > 0
            ? `No recent odds shocks found for "${args.join(' ')}".`
            : 'No recent odds shocks detected in the World Cup markets.'
        )
      }

      let resp = `⚡ Recent World Cup Odds Shocks:\n\n`
      shocks.forEach((s) => {
        const team = s.affected_team === 'home' ? s.home_team : s.away_team
        const arrow = s.direction === 'down' ? '📉' : '📈'
        resp += `${arrow} ${s.home_team} vs ${s.away_team}\n` +
          `• ${team} chances moved ${(Number(s.delta) * 100).toFixed(0)}% in ${s.window_seconds}s\n` +
          `• ${s.explanation || 'No AI commentary yet.'}\n\n`
      })
      ctx.reply(resp)
    } catch {
      ctx.reply('Failed to retrieve odds shock data.')
    }
  })

  // /leaderboard — top 10 Market IQ
  bot.command('leaderboard', async (ctx) => {
    try {
      const { data: leaderboard, error } = await supabase
        .from('lumiere_users')
        .select('username, market_iq')
        .order('market_iq', { ascending: false })
        .limit(10)

      if (error || !leaderboard || leaderboard.length === 0) {
        return ctx.reply('Leaderboard is currently empty.')
      }

      let resp = `🏆 LUMIÈRE Market IQ Leaderboard:\n\n`
      leaderboard.forEach((user, idx) => {
        resp += `${idx + 1}. @${user.username} — ${user.market_iq ?? 0}\n`
      })
      ctx.reply(resp)
    } catch {
      ctx.reply('Failed to load leaderboard.')
    }
  })

  // Auto-expand lumiere code links posted in group messages
  bot.on('text', async (ctx) => {
    try {
      const text = ctx.message.text
      const hostPattern = appHostnames().map((h) => h.replace(/\./g, '\\.')).join('|')
      const pattern = new RegExp(`(?:${hostPattern})/code/([A-Za-z0-9-]+)`, 'i')
      const match = text.match(pattern)
      if (match) {
        const codeId = match[1]
        const { data: code, error } = await supabase
          .from('lumiere_codes')
          .select('lumiere_code, creator_username, overall_edge, selections, status')
          .eq('lumiere_code', codeId)
          .maybeSingle()

        if (error || !code) {
          return ctx.reply(`Could not find a LUMIÈRE code: ${codeId}`)
        }

        const selectionsCount = Array.isArray(code.selections) ? code.selections.length : 0
        const edgePct = code.overall_edge != null ? `${(Number(code.overall_edge) * 100).toFixed(1)}%` : 'n/a'

        ctx.reply(
          `⚡ LUMIÈRE CODE\n\n` +
          `• Code: ${code.lumiere_code}\n` +
          `• Creator: @${code.creator_username}\n` +
          `• Edge: ${edgePct}\n` +
          `• Selections: ${selectionsCount}\n` +
          `• Status: ${code.status || 'pending'}`
        )
      }
    } catch {
      // Ignore text parsing errors
    }
  })
}

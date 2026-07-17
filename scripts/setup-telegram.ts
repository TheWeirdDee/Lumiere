import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import axios from 'axios'

async function setup() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET

  if (!token) {
    console.error('ERROR: TELEGRAM_BOT_TOKEN is not defined in your environment variables.')
    process.exit(1)
  }

  const webhookUrl = `${appUrl}/api/telegram-webhook`
  console.log(`Setting Telegram webhook for bot to: ${webhookUrl}`)

  try {
    const me = await axios.get(`https://api.telegram.org/bot${token}/getMe`)
    const actualUsername = String(me.data?.result?.username || '')
    if (!actualUsername) throw new Error('Telegram getMe did not return a bot username')
    const configuredUsername = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '').replace(/^@/, '')
    if (configuredUsername && configuredUsername.toLowerCase() !== actualUsername.toLowerCase()) {
      throw new Error(`NEXT_PUBLIC_TELEGRAM_BOT_USERNAME is ${configuredUsername}, but this token belongs to @${actualUsername}`)
    }

    const res = await axios.post(`https://api.telegram.org/bot${token}/setWebhook`, {
      url: webhookUrl,
      secret_token: webhookSecret || undefined,
      allowed_updates: ['message', 'callback_query'],
    })
    await axios.post(`https://api.telegram.org/bot${token}/setMyCommands`, {
      commands: [
        { command: 'start', description: 'Open LUMIERE or receive a login code' },
        { command: 'status', description: 'Check bot and TxLINE connectivity' },
        { command: 'odds', description: 'Current TxLINE odds: /odds Argentina' },
        { command: 'shock', description: 'Current odds or recent market shocks' },
        { command: 'followmatch', description: 'Send major match shocks to this group' },
        { command: 'unfollowmatch', description: 'Stop group match alerts' },
        { command: 'mycode', description: 'Your latest LUMIERE codes' },
        { command: 'leaderboard', description: 'Top Market IQ readers' },
      ],
    })
    console.log('Webhook registration response:', res.data)
    console.log(`Verified bot identity: @${actualUsername}`)
    console.log('Telegram Bot webhook has been successfully registered!')
  } catch (err) {
    const detail = axios.isAxiosError(err) ? err.response?.data : err instanceof Error ? err.message : String(err)
    console.error('Failed to set webhook:', detail)
    process.exit(1)
  }
}

setup()

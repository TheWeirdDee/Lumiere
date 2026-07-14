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
    const res = await axios.post(`https://api.telegram.org/bot${token}/setWebhook`, {
      url: webhookUrl,
      secret_token: webhookSecret || undefined,
    })
    console.log('Webhook registration response:', res.data)
    console.log('Telegram Bot webhook has been successfully registered!')
  } catch (err) {
    const detail = axios.isAxiosError(err) ? err.response?.data : err instanceof Error ? err.message : String(err)
    console.error('Failed to set webhook:', detail)
    process.exit(1)
  }
}

setup()

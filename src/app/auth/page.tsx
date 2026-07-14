'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useAuthUser } from '@/lib/use-auth'
import type { TelegramLoginPayload } from '@/lib/telegram-auth'

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramLoginPayload) => void
  }
}

type Tab = 'telegram' | 'email'
type EmailStep = 'enter-email' | 'enter-otp'

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || ''

export default function AuthPage() {
  const router = useRouter()
  const { user, loading } = useAuthUser()
  const [tab, setTab] = useState<Tab>('telegram')
  const [telegramError, setTelegramError] = useState<string | null>(null)
  const telegramContainerRef = useRef<HTMLDivElement>(null)

  const [emailStep, setEmailStep] = useState<EmailStep>('enter-email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailBusy, setEmailBusy] = useState(false)

  // Already logged in — go straight to the app.
  useEffect(() => {
    if (!loading && user) router.replace('/watch')
  }, [loading, user, router])

  const completeLogin = async (userId: string) => {
    const supabase = getSupabaseBrowser()
    const { data: existing } = await supabase.from('lumiere_users').select('username').eq('id', userId).maybeSingle()
    router.push(existing?.username ? '/watch' : '/auth/username')
  }

  // Telegram Login Widget
  useEffect(() => {
    if (tab !== 'telegram' || !telegramContainerRef.current || !BOT_USERNAME) return
    const container = telegramContainerRef.current
    container.innerHTML = ''

    window.onTelegramAuth = (tgUser: TelegramLoginPayload) => {
      void (async () => {
        setTelegramError(null)
        try {
          const res = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tgUser),
          })
          const body = await res.json()
          if (!res.ok) throw new Error(body.error || 'Telegram login failed')

          const supabase = getSupabaseBrowser()
          const { data, error } = await supabase.auth.verifyOtp({ token_hash: body.tokenHash, type: 'magiclink' })
          if (error || !data.session) throw new Error(error?.message || 'Could not start session')

          await completeLogin(data.session.user.id)
        } catch (err) {
          setTelegramError(err instanceof Error ? err.message : String(err))
        }
      })()
    }

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', BOT_USERNAME)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '12')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    container.appendChild(script)

    return () => {
      window.onTelegramAuth = undefined
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError(null)
    setEmailBusy(true)
    const supabase = getSupabaseBrowser()
    const { error } = await supabase.auth.signInWithOtp({ email })
    setEmailBusy(false)
    if (error) {
      setEmailError(error.message)
      return
    }
    setEmailStep('enter-otp')
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError(null)
    setEmailBusy(true)
    const supabase = getSupabaseBrowser()
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
    setEmailBusy(false)
    if (error || !data.session) {
      setEmailError(error?.message || 'Invalid code')
      return
    }
    await completeLogin(data.session.user.id)
  }

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black font-display uppercase tracking-wider text-white">Sign in to LUMIÈRE</h1>
          <p className="text-xs text-gray-400">Choose your login method.</p>
        </div>

        <div className="flex bg-white/5 rounded-full p-1 border border-white/5">
          <button
            onClick={() => setTab('telegram')}
            className={`flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
              tab === 'telegram' ? 'bg-cyan-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Telegram
          </button>
          <button
            onClick={() => setTab('email')}
            className={`flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
              tab === 'email' ? 'bg-cyan-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Email
          </button>
        </div>

        {tab === 'telegram' ? (
          <div className="space-y-4">
            <p className="text-xs text-gray-400 text-center leading-relaxed">Log in with one tap via Telegram.</p>
            <div ref={telegramContainerRef} className="flex justify-center min-h-[44px]" />
            {!BOT_USERNAME && (
              <p className="text-xs text-amber-500 text-center">
                NEXT_PUBLIC_TELEGRAM_BOT_USERNAME is not set — Telegram login is unavailable.
              </p>
            )}
            {telegramError && <p className="text-xs text-rose-400 text-center">{telegramError}</p>}
          </div>
        ) : (
          <form onSubmit={emailStep === 'enter-email' ? handleSendOtp : handleVerifyOtp} className="space-y-4">
            {emailStep === 'enter-email' ? (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Email address</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full bg-[#0a0a0a] border border-white/10 text-white text-xs font-medium rounded-xl px-4 py-3.5 focus:outline-none focus:border-cyan-500 transition-all duration-300"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                  6-digit code sent to {email}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.trim())}
                  placeholder="123456"
                  className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm font-mono tracking-[0.3em] text-center rounded-xl px-4 py-3.5 focus:outline-none focus:border-cyan-500 transition-all duration-300"
                />
                <button
                  type="button"
                  onClick={() => setEmailStep('enter-email')}
                  className="mt-2 text-[10px] text-gray-500 hover:text-white transition-colors"
                >
                  ← Use a different email
                </button>
              </div>
            )}

            {emailError && <p className="text-xs text-rose-400">{emailError}</p>}

            <button
              type="submit"
              disabled={emailBusy}
              className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 text-black font-bold text-xs uppercase tracking-widest transition-all duration-200"
            >
              {emailBusy ? 'Please wait...' : emailStep === 'enter-email' ? 'Send code' : 'Verify & continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useAuthUser } from '@/lib/use-auth'
import { LogoMark } from '@/components/Logo'
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
    // Supabase's default (non-custom-SMTP) email contains a sign-in LINK, not
    // a code — send the user to /auth/callback, which exchanges it for a
    // session and routes to /watch or /auth/username. The code input stays as
    // a fallback for projects with custom SMTP templates that include a token.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setEmailBusy(false)
    if (error) {
      setEmailError(error.message)
      return
    }
    setEmailStep('enter-otp')
  }

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <Link href="/" className="inline-block">
            <LogoMark size={44} />
          </Link>
          <h1 className="text-2xl font-black font-display uppercase tracking-wider text-white">Sign in to LUMIÈRE</h1>
          <p className="text-xs text-gray-400">Choose your login method.</p>
        </div>

        <div className="flex bg-white/5 rounded-full p-1 border border-white/5">
          <button
            onClick={() => setTab('telegram')}
            className={`flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
              tab === 'telegram' ? 'bg-[#f5c518] text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Telegram
          </button>
          <button
            onClick={() => setTab('email')}
            className={`flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
              tab === 'email' ? 'bg-[#f5c518] text-black' : 'text-gray-400 hover:text-white'
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
            <p className="text-[11px] text-gray-500 text-center leading-relaxed">
              Telegram only shows its login button on the app&apos;s registered domain. If nothing appears above
              (e.g. on localhost), use the Email tab.
            </p>
          </div>
        ) : emailStep === 'enter-email' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Email address</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full bg-[#0a0a0a] border border-white/10 text-white text-xs font-medium rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#f5c518] transition-all duration-300"
              />
            </div>

            {emailError && <p className="text-xs text-rose-400">{emailError}</p>}

            <button
              type="submit"
              disabled={emailBusy}
              className="w-full py-3.5 rounded-xl bg-[#f5c518] hover:bg-[#e2b514] disabled:opacity-40 text-black font-bold text-xs uppercase tracking-widest transition-all duration-200"
            >
              {emailBusy ? 'Please wait...' : 'Send sign-in link'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border px-5 py-6 text-center" style={{ borderColor: 'rgba(245,197,24,0.3)', background: 'rgba(245,197,24,0.06)' }}>
              <p className="text-base text-white font-semibold font-display">Check your inbox</p>
              <p className="mt-2 text-xs text-gray-300 leading-relaxed">
                We sent a sign-in link to <span className="text-white font-semibold">{email}</span>.
                <br />
                Tap it in this browser and you&apos;re in — nothing to type.
              </p>
            </div>
            {emailError && <p className="text-xs text-rose-400 text-center">{emailError}</p>}
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() => setEmailStep('enter-email')}
                className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
              >
                ← Different email
              </button>
              <button
                type="button"
                disabled={emailBusy}
                onClick={(e) => handleSendOtp(e as unknown as React.FormEvent)}
                className="text-[10px] font-bold uppercase tracking-widest hover:underline disabled:opacity-40"
                style={{ color: '#f5c518' }}
              >
                {emailBusy ? 'Sending...' : 'Resend link'}
              </button>
            </div>
          </div>
        )}

        <div className="text-center pt-2">
          <Link
            href="/watch?demo=true"
            className="text-xs font-bold uppercase tracking-widest hover:underline"
            style={{ color: '#f5c518' }}
          >
            Just looking? Watch the demo — no account needed →
          </Link>
        </div>
      </div>
    </div>
  )
}

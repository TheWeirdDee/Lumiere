'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useAuthUser } from '@/lib/use-auth'
import { LogoMark } from '@/components/Logo'

type Tab = 'telegram' | 'email'
type EmailStep = 'enter-email' | 'enter-otp'

export default function AuthPage() {
  const router = useRouter()
  const { user, loading } = useAuthUser()
  const [tab, setTab] = useState<Tab>('telegram')
  const [telegramError, setTelegramError] = useState<string | null>(null)
  const [telegramStartUrl, setTelegramStartUrl] = useState<string | null>(null)
  const [telegramCode, setTelegramCode] = useState('')
  const [telegramBusy, setTelegramBusy] = useState(false)

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

  const prepareTelegramLogin = useCallback(async () => {
    setTelegramError(null)
    setTelegramStartUrl(null)
    try {
      const res = await fetch('/api/auth/telegram-code/start', { cache: 'no-store' })
      const body = (await res.json()) as { botUrl?: string; error?: string }
      if (!res.ok || !body.botUrl) {
        throw new Error(body.error || 'Could not prepare Telegram login')
      }
      setTelegramStartUrl(body.botUrl)
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : String(error))
    }
  }, [])

  useEffect(() => {
    if (tab === 'telegram') void prepareTelegramLogin()
  }, [tab, prepareTelegramLogin])

  const handleTelegramCode = async (event: React.FormEvent) => {
    event.preventDefault()
    setTelegramError(null)
    setTelegramBusy(true)
    try {
      const res = await fetch('/api/auth/telegram-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: telegramCode }),
      })
      const body = (await res.json()) as { tokenHash?: string; error?: string }
      if (!res.ok || !body.tokenHash) {
        throw new Error(body.error || 'Telegram login failed')
      }

      const supabase = getSupabaseBrowser()
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: body.tokenHash,
        type: 'magiclink',
      })
      if (error || !data.session) {
        throw new Error(error?.message || 'Could not start session')
      }
      await completeLogin(data.session.user.id)
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : String(error))
    } finally {
      setTelegramBusy(false)
    }
  }

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
          <form onSubmit={handleTelegramCode} className="space-y-4">
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-center">
              <p className="text-xs font-semibold text-white">Sign in through the Lumiere Telegram bot</p>
              <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                Open the bot, tap Start, copy the complete login code it sends, then paste it below.
                The code expires after 10 minutes.
              </p>
            </div>

            <a
              href={telegramStartUrl || undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!telegramStartUrl}
              className={`block w-full rounded-xl px-4 py-3 text-center text-xs font-bold uppercase tracking-wider transition-colors ${
                telegramStartUrl
                  ? 'bg-[#229ED9] text-white hover:bg-[#168ac0]'
                  : 'pointer-events-none bg-white/5 text-gray-600'
              }`}
            >
              {telegramStartUrl ? '1. Open Lumiere bot' : 'Preparing Telegram...'}
            </a>

            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
                2. Paste the login code
              </label>
              <textarea
                required
                rows={3}
                value={telegramCode}
                onChange={(event) => setTelegramCode(event.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="one-time-code"
                spellCheck={false}
                placeholder="LUM1..."
                className="w-full resize-none rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 font-mono text-base text-white focus:border-[#f5c518] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={telegramBusy || !telegramCode.trim()}
              className="w-full rounded-xl bg-[#f5c518] py-3.5 text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-[#e2b514] disabled:opacity-40"
            >
              {telegramBusy ? 'Signing in...' : 'Sign in with Telegram code'}
            </button>

            <button
              type="button"
              onClick={() => void prepareTelegramLogin()}
              className="w-full text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white"
            >
              Get a new bot link
            </button>
            {telegramError && <p className="text-xs text-rose-400 text-center">{telegramError}</p>}
            <p className="text-[11px] text-gray-500 text-center leading-relaxed">
              No Telegram authorization popup or phone-number code is required. Use the Email tab if the bot is unavailable.
            </p>
          </form>
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

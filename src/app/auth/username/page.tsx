'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useAuthUser } from '@/lib/use-auth'

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/

export default function UsernamePage() {
  const { user, loading } = useAuthUser()
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/auth')
  }, [loading, user, router])

  const isValid = USERNAME_PATTERN.test(username)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !isValid || submitting) return
    setSubmitting(true)
    setError(null)

    const supabase = getSupabaseBrowser()

    const { data: taken } = await supabase.from('lumiere_users').select('id').eq('username', username).maybeSingle()
    if (taken) {
      setError('This username is taken, try another')
      setSubmitting(false)
      return
    }

    const telegramId = (user.user_metadata?.telegram_id as string | undefined) ?? null

    const { error: insertErr } = await supabase.from('lumiere_users').insert({
      id: user.id,
      username,
      telegram_id: telegramId,
      market_iq: 0,
    })

    if (insertErr) {
      setError(insertErr.message.includes('duplicate') ? 'This username is taken, try another' : insertErr.message)
      setSubmitting(false)
      return
    }

    router.push('/watch')
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808] text-gray-400">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black font-display uppercase tracking-wider text-white">Choose your username</h1>
          <p className="text-xs text-gray-400 leading-relaxed">
            Permanent — shown on every code you share and on the leaderboard.
          </p>
        </div>

        <div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">@</span>
            <input
              type="text"
              autoFocus
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.trim())
                setError(null)
              }}
              placeholder="username"
              className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm font-semibold rounded-xl pl-8 pr-4 py-3.5 focus:outline-none focus:border-cyan-500 transition-all duration-300 lowercase"
            />
          </div>
          <p className="mt-2 text-[10px] text-gray-500 font-mono">3-20 characters, letters/numbers/underscores only.</p>
          {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={!isValid || submitting}
          className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-xs uppercase tracking-widest transition-all duration-200"
        >
          {submitting ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  )
}

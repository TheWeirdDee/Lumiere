'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRequireAuth } from '@/lib/use-auth'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import MarketIQScore from '@/components/MarketIQScore'
import EdgeBadge from '@/components/EdgeBadge'

interface Profile {
  username: string
  market_iq: number
  total_codes: number
  winning_codes: number
}

interface CodeSummary {
  id: string
  lumiere_code: string
  platform: string
  overall_edge: number | null
  status: string
  created_at: string
}

interface CallSummary {
  id: string
  choice: 'follow' | 'fade'
  status: 'pending' | 'won' | 'lost' | 'push'
  iq_delta: number
  retention: number | null
  verified: boolean
  created_at: string
}

export default function ProfilePage() {
  const { user, loading } = useRequireAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [codes, setCodes] = useState<CodeSummary[]>([])
  const [calls, setCalls] = useState<CallSummary[]>([])

  useEffect(() => {
    if (!user) return
    const supabase = getSupabaseBrowser()
    supabase
      .from('lumiere_users')
      .select('username, market_iq, total_codes, winning_codes')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data))

    fetch('/api/codes')
      .then((r) => r.json())
      .then((d) => setCodes(d.codes || []))
      .catch(() => undefined)

    supabase
      .from('lumiere_market_calls')
      .select('id, choice, status, iq_delta, retention, verified, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setCalls((data || []) as CallSummary[]))
  }, [user])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808] text-gray-400">
        <div className="w-8 h-8 rounded-full border-2 border-[#f5c518]/25 border-t-[#f5c518] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] px-6 py-12">
      <div className="max-w-xl mx-auto mb-8 flex items-center justify-between">
        <Link href="/watch" className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors">
          ← Back
        </Link>
        <span
          onClick={async () => {
            await getSupabaseBrowser().auth.signOut()
            window.location.href = '/'
          }}
          className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-white transition-colors cursor-pointer"
        >
          Sign out
        </span>
      </div>

      <div className="max-w-xl mx-auto space-y-8">
        {profile && (
          <div className="glass-panel rounded-2xl border border-white/5 p-6 text-center space-y-3">
            <div className="text-2xl font-black font-display uppercase tracking-wider text-white">@{profile.username}</div>
            <MarketIQScore score={profile.market_iq} size="lg" />
            <div className="text-xs text-gray-500 font-mono">
              {profile.total_codes} code{profile.total_codes === 1 ? '' : 's'} · {profile.winning_codes} won
            </div>
          </div>
        )}

        <div className='space-y-2'>
          <h3 className='text-xs font-bold uppercase tracking-widest text-[#f5c518]'>Your market calls</h3>
          {calls.length === 0 ? (
            <p className='py-6 text-center text-sm text-gray-500'>No verified calls yet. Follow or Fade the next live market shock.</p>
          ) : (
            calls.map((call) => (
              <div key={call.id} className='flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4'>
                <div>
                  <div className='text-sm font-bold uppercase text-white'>{call.choice} the move</div>
                  <div className='mt-0.5 text-[10px] uppercase tracking-wider text-gray-500'>{call.status}{call.retention !== null ? ` | ${Math.round(Number(call.retention) * 100)}% held` : ''}</div>
                </div>
                <span className={`font-mono text-sm font-bold ${call.iq_delta > 0 ? 'text-emerald-400' : call.iq_delta < 0 ? 'text-rose-400' : 'text-gray-500'}`}>
                  {call.verified ? `${call.iq_delta > 0 ? '+' : ''}${call.iq_delta} IQ` : 'Practice'}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#f5c518]">Your codes</h3>
          {codes.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No codes yet — build one from a live shock alert.</p>
          ) : (
            codes.map((c) => (
              <Link
                key={c.id}
                href={`/code/${c.lumiere_code}`}
                className="flex items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-colors"
              >
                <div>
                  <div className="text-sm font-mono font-semibold text-white">{c.lumiere_code}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{c.status}</div>
                </div>
                <EdgeBadge edge={c.overall_edge} size="sm" />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

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

interface CallStats {
  total: number
  won: number
  lost: number
  push: number
  pending: number
  accuracy: number | null
  currentStreak: number
  bestStreak: number
  followWon: number
  followDecided: number
  fadeWon: number
  fadeDecided: number
}

/** Presentation-only aggregation over verified calls — never touches scoring. */
function computeStats(calls: CallSummary[]): CallStats {
  const verified = calls.filter((c) => c.verified)
  const won = verified.filter((c) => c.status === 'won').length
  const lost = verified.filter((c) => c.status === 'lost').length
  const push = verified.filter((c) => c.status === 'push').length
  const pending = verified.filter((c) => c.status === 'pending').length

  // Streaks over decided calls, newest-first input; pushes neither extend nor break.
  const decided = verified.filter((c) => c.status === 'won' || c.status === 'lost')
  let currentStreak = 0
  for (const call of decided) {
    if (call.status === 'won') currentStreak += 1
    else break
  }
  let bestStreak = 0
  let run = 0
  for (const call of decided) {
    run = call.status === 'won' ? run + 1 : 0
    bestStreak = Math.max(bestStreak, run)
  }

  const followDecidedCalls = decided.filter((c) => c.choice === 'follow')
  const fadeDecidedCalls = decided.filter((c) => c.choice === 'fade')

  return {
    total: verified.length,
    won,
    lost,
    push,
    pending,
    accuracy: won + lost > 0 ? won / (won + lost) : null,
    currentStreak,
    bestStreak,
    followWon: followDecidedCalls.filter((c) => c.status === 'won').length,
    followDecided: followDecidedCalls.length,
    fadeWon: fadeDecidedCalls.filter((c) => c.status === 'won').length,
    fadeDecided: fadeDecidedCalls.length,
  }
}

const PERSONALITY_MIN_CALLS = 10

interface Personality {
  label: string
  blurb: string
}

/** Descriptive only — derived from verified history, never affects scoring. */
function derivePersonality(stats: CallStats): Personality {
  const decided = stats.won + stats.lost
  if (decided < PERSONALITY_MIN_CALLS) {
    const remaining = PERSONALITY_MIN_CALLS - decided
    return {
      label: 'Market Observer',
      blurb: `Make ${remaining} more live call${remaining === 1 ? '' : 's'} to reveal your market personality.`,
    }
  }

  const accuracy = Math.round((stats.accuracy ?? 0) * 100)
  const fadeShare = stats.fadeDecided / decided
  const followShare = stats.followDecided / decided

  if (fadeShare >= 0.6 && stats.fadeDecided > 0) {
    const fadeAccuracy = Math.round((stats.fadeWon / stats.fadeDecided) * 100)
    return {
      label: 'Contrarian',
      blurb: `You fade sudden market swings — and you're right ${fadeAccuracy}% of the time.`,
    }
  }
  if (followShare >= 0.6 && stats.followDecided > 0) {
    const followAccuracy = Math.round((stats.followWon / stats.followDecided) * 100)
    return {
      label: 'Momentum Rider',
      blurb: `You back the market's momentum — and you're right ${followAccuracy}% of the time.`,
    }
  }
  if (accuracy >= 70) {
    return {
      label: 'Market Whisperer',
      blurb: `Follow or fade, you read the movement correctly ${accuracy}% of the time.`,
    }
  }
  return {
    label: 'Market Reader',
    blurb: `You weigh each shock on its own — correct ${accuracy}% of the time so far.`,
  }
}

export default function ProfilePage() {
  const { user, loading } = useRequireAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [codes, setCodes] = useState<CodeSummary[]>([])
  const [calls, setCalls] = useState<CallSummary[]>([])
  const [rank, setRank] = useState<{ position: number; total: number } | null>(null)

  useEffect(() => {
    if (!user) return
    const supabase = getSupabaseBrowser()
    supabase
      .from('lumiere_users')
      .select('username, market_iq, total_codes, winning_codes')
      .eq('id', user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        setProfile(data)
        if (!data) return
        // Leaderboard percentile: presentation-only, from real counts.
        const [{ count: above }, { count: total }] = await Promise.all([
          supabase.from('lumiere_users').select('id', { count: 'exact', head: true }).gt('market_iq', data.market_iq),
          supabase.from('lumiere_users').select('id', { count: 'exact', head: true }),
        ])
        if (typeof above === 'number' && typeof total === 'number' && total > 0) {
          setRank({ position: above + 1, total })
        }
      })

    fetch('/api/codes')
      .then((r) => r.json())
      .then((d) => setCodes(d.codes || []))
      .catch(() => undefined)

    supabase
      .from('lumiere_market_calls')
      .select('id, choice, status, iq_delta, retention, verified, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => setCalls((data || []) as CallSummary[]))
  }, [user])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808] text-gray-400">
        <div className="w-8 h-8 rounded-full border-2 border-[#f5c518]/25 border-t-[#f5c518] animate-spin" />
      </div>
    )
  }

  const stats = computeStats(calls)
  const personality = derivePersonality(stats)
  const percentile = rank ? Math.max(1, Math.round((rank.position / rank.total) * 100)) : null
  const recentDecided = calls.filter((c) => c.verified && (c.status === 'won' || c.status === 'lost')).slice(0, 8)

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
          <div className="glass-panel rounded-2xl border border-white/5 p-6 space-y-5">
            <div className="text-center space-y-3">
              <div className="text-2xl font-black font-display uppercase tracking-wider text-white">@{profile.username}</div>
              <MarketIQScore score={profile.market_iq} size="lg" />
              {rank && rank.total > 1 && (
                <div className="text-[11px] font-mono uppercase tracking-widest text-gray-400">
                  {rank.total >= 50 && percentile !== null ? `Top ${percentile}%` : `Rank #${rank.position} of ${rank.total}`}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-5">
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center">
                <div className="font-mono text-lg font-bold text-white">
                  {stats.accuracy !== null ? `${Math.round(stats.accuracy * 100)}%` : '—'}
                </div>
                <div className="mt-0.5 text-[9px] uppercase tracking-widest text-gray-500">Accuracy</div>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center">
                <div className="font-mono text-lg font-bold text-white">{stats.currentStreak}</div>
                <div className="mt-0.5 text-[9px] uppercase tracking-widest text-gray-500">Streak</div>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center">
                <div className="font-mono text-lg font-bold text-white">{stats.bestStreak}</div>
                <div className="mt-0.5 text-[9px] uppercase tracking-widest text-gray-500">Best streak</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 font-mono text-[11px] text-gray-400">
              <span>{stats.total} call{stats.total === 1 ? '' : 's'}</span>
              <span className="text-emerald-400">{stats.won} correct</span>
              <span className="text-rose-400">{stats.lost} wrong</span>
              {stats.push > 0 && <span className="text-gray-500">{stats.push} push</span>}
            </div>

            {recentDecided.length > 0 && (
              <div className="flex items-center justify-center gap-1.5">
                {[...recentDecided].reverse().map((call) => (
                  <span
                    key={call.id}
                    title={`${call.choice} — ${call.status}`}
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                      call.status === 'won'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                    }`}
                  >
                    {call.status === 'won' ? '✓' : '✕'}
                  </span>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-[#f5c518]/15 bg-[#f5c518]/[0.04] p-4 text-center">
              <div className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Market Personality</div>
              <div className="text-sm font-black font-display uppercase tracking-wider text-[#f5c518]">{personality.label}</div>
              <p className="mt-1 text-xs text-gray-400 leading-relaxed">{personality.blurb}</p>
            </div>
          </div>
        )}

        <div className='space-y-2'>
          <h3 className='text-xs font-bold uppercase tracking-widest text-[#f5c518]'>Your market calls</h3>
          {calls.length === 0 ? (
            <div className='rounded-xl border border-white/5 bg-white/[0.02] py-8 px-6 text-center'>
              <p className='text-sm text-gray-400'>No verified calls yet.</p>
              <p className='mt-2 text-xs text-gray-500 leading-relaxed'>
                When the next odds shock appears, choose Follow or Fade.
                <br />
                Every decision is tracked and builds your Market IQ.
              </p>
            </div>
          ) : (
            calls.slice(0, 10).map((call) => (
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
            <div className="rounded-xl border border-white/5 bg-white/[0.02] py-8 px-6 text-center">
              <p className="text-sm text-gray-400">Nothing shared yet.</p>
              <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                The next market shock can become your first tracked code.
              </p>
            </div>
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

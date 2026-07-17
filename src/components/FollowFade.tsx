'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { OddsEvent } from '@/lib/txline/types'
import type { MarketCall, MarketCallChoice, OddsShock } from '@/types'
import { MARKET_CALL_HORIZON_MS, resolveMarketCall } from '@/lib/market-call-rules'
import { useAuthUser } from '@/lib/use-auth'

interface FollowFadeProps {
  shock: OddsShock
  latestOdds: OddsEvent | null
  isDemo: boolean
}

function localKey(shock: OddsShock): string {
  return `lumiere_demo_call_${shock.id || `${shock.matchId}_${shock.affectedTeam}_${shock.firedAt}`}`
}

function secondsLabel(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export default function FollowFade({ shock, latestOdds, isDemo }: FollowFadeProps) {
  const { user, loading } = useAuthUser()
  const [call, setCall] = useState<MarketCall | null>(null)
  const [busy, setBusy] = useState<MarketCallChoice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, setClock] = useState(0)
  const team = shock.affectedTeam === 'home' ? shock.homeTeam : shock.awayTeam
  const storageKey = useMemo(() => localKey(shock), [shock])
  const sponsorName = process.env.NEXT_PUBLIC_SHOCK_SPONSOR_NAME
  const sponsorUrl = process.env.NEXT_PUBLIC_SHOCK_SPONSOR_URL

  useEffect(() => {
    setCall(null)
    setError(null)
    if (isDemo || (!loading && !user)) {
      try {
        const saved = localStorage.getItem(storageKey)
        if (saved) setCall(JSON.parse(saved) as MarketCall)
      } catch {
        localStorage.removeItem(storageKey)
      }
      return
    }
    if (!loading && user && shock.id) {
      fetch(`/api/market-calls?shockId=${encodeURIComponent(shock.id)}`, { cache: 'no-store' })
        .then((response) => response.json())
        .then((body) => setCall(body.calls?.[0] ?? null))
        .catch(() => undefined)
    }
  }, [isDemo, loading, shock.id, storageKey, user])

  useEffect(() => {
    if (!call || call.status !== 'pending' || call.verified) return
    if (!latestOdds || latestOdds.matchId !== call.matchId || latestOdds.timestamp < call.targetEventAt) return
    const resolvedProb = call.affectedTeam === 'home' ? latestOdds.homeProb : latestOdds.awayProb
    const result = resolveMarketCall(call.choice, call.preProb, call.postProb, resolvedProb)
    const resolved: MarketCall = {
      ...call,
      ...result,
      resolvedProb,
      resolvedAt: latestOdds.timestamp,
    }
    setCall(resolved)
    localStorage.setItem(storageKey, JSON.stringify(resolved))
  }, [call, latestOdds, storageKey])

  useEffect(() => {
    if (!call || call.status !== 'pending' || !call.verified || !shock.id) return
    const poll = () => {
      fetch(`/api/market-calls?shockId=${encodeURIComponent(shock.id!)}`, { cache: 'no-store' })
        .then((response) => response.json())
        .then((body) => {
          if (body.calls?.[0]) setCall(body.calls[0])
        })
        .catch(() => undefined)
    }
    const timer = setInterval(poll, 5_000)
    return () => clearInterval(timer)
  }, [call, shock.id])

  useEffect(() => {
    const timer = setInterval(() => setClock((value) => value + 1), 1_000)
    return () => clearInterval(timer)
  }, [])

  const choose = async (choice: MarketCallChoice) => {
    setBusy(choice)
    setError(null)
    try {
      if (isDemo || !user) {
        const localCall: MarketCall = {
          id: `demo-${shock.id || shock.firedAt}`,
          shockId: shock.id || `replay-${shock.firedAt}`,
          matchId: shock.matchId,
          choice,
          affectedTeam: shock.affectedTeam,
          preProb: shock.preProb,
          postProb: shock.postProb,
          targetEventAt: shock.firedAt + MARKET_CALL_HORIZON_MS,
          status: 'pending',
          iqDelta: 0,
          verified: false,
          createdAt: Date.now(),
        }
        setCall(localCall)
        localStorage.setItem(storageKey, JSON.stringify(localCall))
        return
      }
      if (!shock.id) throw new Error('The shock is still being verified. Try again in a moment.')
      const response = await fetch('/api/market-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shockId: shock.id, choice }),
      })
      const body = await response.json()
      if (!response.ok || !body.call) throw new Error(body.error || 'Could not save your call')
      setCall(body.call)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your call')
    } finally {
      setBusy(null)
    }
  }

  const feedNow = latestOdds?.timestamp ?? Date.now()
  const remaining = call ? call.targetEventAt - (call.verified ? Date.now() : feedNow) : 0
  const retentionPercent = call?.retention === undefined ? null : Math.round(call.retention * 100)

  if (!call) {
    return (
      <div className='rounded-2xl border border-[#f5c518]/25 bg-[#f5c518]/[0.06] p-4'>
        <div className='mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-[#f5c518]'>
          TxLINE Follow / Fade
        </div>
        <p className='mb-3 text-sm font-semibold text-white'>Will {team}&apos;s market move still hold in five match minutes?</p>
        <div className='grid grid-cols-2 gap-2'>
          <button onClick={() => void choose('follow')} disabled={busy !== null} className='rounded-xl bg-emerald-400 px-3 py-3 text-xs font-black uppercase tracking-wider text-black disabled:opacity-40'>
            {busy === 'follow' ? 'Locking...' : 'Follow move'}
          </button>
          <button onClick={() => void choose('fade')} disabled={busy !== null} className='rounded-xl bg-rose-400 px-3 py-3 text-xs font-black uppercase tracking-wider text-black disabled:opacity-40'>
            {busy === 'fade' ? 'Locking...' : 'Fade move'}
          </button>
        </div>
        <p className='mt-2 text-[10px] text-gray-500'>One call. No money. Live calls affect Market IQ; replay calls are practice.</p>
        {sponsorName && (
          sponsorUrl ? (
            <a href={sponsorUrl} target='_blank' rel='sponsored noreferrer' className='mt-3 block text-center text-[9px] font-bold uppercase tracking-widest text-gray-500 hover:text-white'>Market moment presented by {sponsorName}</a>
          ) : (
            <p className='mt-3 text-center text-[9px] font-bold uppercase tracking-widest text-gray-500'>Market moment presented by {sponsorName}</p>
          )
        )}
        {error && <p className='mt-2 text-xs text-rose-300'>{error}</p>}
      </div>
    )
  }

  if (call.status === 'pending') {
    return (
      <div className='rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center'>
        <div className='font-mono text-[10px] font-bold uppercase tracking-widest text-[#f5c518]'>
          {call.verified ? 'TxLINE live call locked' : 'TxLINE replay practice'}
        </div>
        <div className='mt-2 text-lg font-black uppercase text-white'>{call.choice} the move</div>
        <p className='mt-1 text-xs text-gray-400'>Resolves from the next TxLINE update after {secondsLabel(remaining)}</p>
      </div>
    )
  }

  const resultText = call.status === 'push' ? 'Push' : call.status === 'won' ? 'Correct call' : 'Wrong call'
  const shareText = `${resultText}: I ${call.choice.toUpperCase()}D ${team}'s market move on LUMIERE. ${retentionPercent ?? 0}% held after five minutes.`
  const shareUrl = typeof window === 'undefined' ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/watch?match=${encodeURIComponent(shock.matchId)}` : window.location.href
  return (
    <div className='rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center'>
      <div className='font-mono text-[10px] font-bold uppercase tracking-widest text-[#f5c518]'>
        {call.verified ? 'TxLINE verified result' : 'TxLINE replay result'}
      </div>
      <div className={`mt-2 text-xl font-black uppercase ${call.status === 'won' ? 'text-emerald-400' : call.status === 'lost' ? 'text-rose-400' : 'text-gray-300'}`}>
        {resultText}
      </div>
      <p className='mt-1 text-xs text-gray-300'>{retentionPercent}% of the original move held</p>
      <p className='mt-1 font-mono text-xs text-[#f5c518]'>
        {call.verified ? `${call.iqDelta >= 0 ? '+' : ''}${call.iqDelta} Market IQ` : 'Practice result — leaderboard unchanged'}
      </p>
      <a href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`} target='_blank' rel='noreferrer' className='mt-3 inline-block text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white'>
        Share result to Telegram →
      </a>
    </div>
  )
}

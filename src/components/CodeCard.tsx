'use client'

import React, { useState } from 'react'
import EdgeBadge from './EdgeBadge'
import SelectionRow from './SelectionRow'
import type { Selection, SelectionStatus } from '@/types'

interface CodeCardSelection extends Selection {
  liveLabel?: SelectionStatus | 'live' | 'pending'
  liveScore?: { home: number; away: number } | null
}

interface CodeCardProps {
  lumiereCode: string
  creatorUsername: string
  platform: string
  platformCode?: string | null
  overallEdge: number | null
  status: string
  selections: CodeCardSelection[]
}

const PLATFORM_LABELS: Record<string, string> = {
  sportybet: 'SportyBet',
  bet9ja: 'bet9ja',
  '1xbet': '1xBet',
  '247bet': '247Bet',
  other: 'Other',
}

export default function CodeCard({ lumiereCode, creatorUsername, platform, platformCode, overallEdge, status, selections }: CodeCardProps) {
  const [copied, setCopied] = useState(false)
  const affiliateEnabled = process.env.NEXT_PUBLIC_AFFILIATE_LINKS_ENABLED === 'true'

  const handleCopy = () => {
    if (!platformCode) return
    navigator.clipboard.writeText(platformCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleShare = () => {
    const link = window.location.href
    const text = `Track ${lumiereCode} by @${creatorUsername} live on LUMIERE.`
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`, '_blank')
    void fetch(`/api/codes/${encodeURIComponent(lumiereCode)}`, { method: 'POST' }).catch(() => undefined)
  }

  return (
    <div className="glass-panel rounded-2xl border border-white/5 p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-black font-mono text-white">{lumiereCode}</div>
          <div className="text-xs text-gray-400 mt-1">
            @{creatorUsername} · {selections.length} selection{selections.length === 1 ? '' : 's'} · {PLATFORM_LABELS[platform] || platform}
          </div>
        </div>
        <EdgeBadge edge={overallEdge} />
      </div>

      <div className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full w-fit bg-white/5 text-gray-300 border border-white/10">
        Status: {status}
      </div>

      <div className="space-y-2">
        {selections.map((s) => (
          <SelectionRow
            key={s.id}
            selection={s}
            status={(s.liveLabel ?? s.status) as 'pending' | 'won' | 'lost' | 'void' | 'live'}
            liveScore={s.liveScore}
          />
        ))}
      </div>

      {platformCode && (
        <button
          onClick={handleCopy}
          className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-200 ${
            copied ? 'bg-emerald-500 text-black' : 'bg-white/5 border border-white/10 hover:bg-white/10 text-white'
          }`}
        >
          {copied ? '✓ Copied' : `Copy ${PLATFORM_LABELS[platform] || platform} code: ${platformCode}`}
        </button>
      )}

      <div className='grid gap-2 sm:grid-cols-2'>
        <button onClick={handleShare} className='w-full rounded-xl border border-[#229ED9]/30 bg-[#229ED9]/10 py-3 text-xs font-bold uppercase tracking-widest text-[#65bce6] hover:bg-[#229ED9]/20'>
          Share to Telegram
        </button>
        {affiliateEnabled && platform !== 'other' && (
          <a
            href={`/api/out/${encodeURIComponent(platform)}?lumiereCode=${encodeURIComponent(lumiereCode)}&bookingCode=${encodeURIComponent(platformCode || '')}`}
            target='_blank'
            rel='sponsored noreferrer'
            className='w-full rounded-xl border border-[#f5c518]/30 bg-[#f5c518]/10 py-3 text-center text-xs font-bold uppercase tracking-widest text-[#f5c518] hover:bg-[#f5c518]/20'
          >
            Open in {PLATFORM_LABELS[platform] || platform}
          </a>
        )}
      </div>
    </div>
  )
}

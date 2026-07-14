import React from 'react'
import MarketIQScore from './MarketIQScore'

export interface LeaderboardEntry {
  username: string
  market_iq: number
  total_codes: number
  winning_codes: number
  win_rate: number | null
}

interface LeaderboardProps {
  entries: LeaderboardEntry[]
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard({ entries }: LeaderboardProps) {
  if (entries.length === 0) {
    return (
      <div className="glass-panel rounded-2xl border border-white/5 p-10 text-center text-sm text-gray-500">
        No Market IQ scores yet — resolve a code to appear here.
      </div>
    )
  }

  return (
    <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
      {entries.map((entry, idx) => (
        <div
          key={entry.username}
          className={`flex items-center justify-between gap-4 px-5 py-4 ${idx !== entries.length - 1 ? 'border-b border-white/5' : ''}`}
        >
          <div className="flex items-center gap-4 min-w-0">
            <span className="w-6 text-center text-sm font-mono text-gray-500">{MEDALS[idx] || idx + 1}</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white font-display truncate">@{entry.username}</div>
              <div className="text-[10px] text-gray-500 font-mono">
                {entry.total_codes} code{entry.total_codes === 1 ? '' : 's'}
                {entry.win_rate !== null ? ` · ${entry.win_rate}% win rate` : ''}
              </div>
            </div>
          </div>
          <MarketIQScore score={entry.market_iq} />
        </div>
      ))}
    </div>
  )
}

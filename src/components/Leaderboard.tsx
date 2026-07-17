import React from 'react'
import MarketIQScore from './MarketIQScore'

export interface LeaderboardEntry {
  username: string
  market_iq: number
  total_codes: number
  winning_codes: number
  win_rate: number | null
  market_calls: number
  correct_calls: number
  call_accuracy: number | null
}

interface LeaderboardProps {
  entries: LeaderboardEntry[]
}

const MEDALS = ['1', '2', '3']

export default function Leaderboard({ entries }: LeaderboardProps) {
  if (entries.length === 0) {
    return (
      <div className='glass-panel rounded-2xl border border-white/5 p-10 text-center text-sm text-gray-500'>
        No Market IQ scores yet. Make a live Follow/Fade call to appear here.
      </div>
    )
  }

  return (
    <div className='glass-panel overflow-hidden rounded-2xl border border-white/5'>
      {entries.map((entry, index) => (
        <div key={entry.username} className={`flex items-center justify-between gap-4 px-5 py-4 ${index !== entries.length - 1 ? 'border-b border-white/5' : ''}`}>
          <div className='flex min-w-0 items-center gap-4'>
            <span className='w-6 text-center font-mono text-sm text-gray-500'>{MEDALS[index] || index + 1}</span>
            <div className='min-w-0'>
              <div className='truncate font-display text-sm font-semibold text-white'>@{entry.username}</div>
              <div className='font-mono text-[10px] text-gray-500'>
                {entry.total_codes} code{entry.total_codes === 1 ? '' : 's'}
                {entry.win_rate !== null ? ` | ${entry.win_rate}% code win rate` : ''}
                {entry.market_calls > 0 ? ` | ${entry.correct_calls}/${entry.market_calls} calls${entry.call_accuracy !== null ? ` (${entry.call_accuracy}%)` : ''}` : ''}
              </div>
            </div>
          </div>
          <MarketIQScore score={entry.market_iq} />
        </div>
      ))}
    </div>
  )
}

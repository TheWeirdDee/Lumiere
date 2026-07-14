// src/components/MatchCard.tsx
'use client'

import React from 'react'
import Link from 'next/link'
import type { Fixture, GamePhase } from '../lib/txline/types'

interface MatchCardProps {
  match: Fixture
  isLive?: boolean
}

function isCompleted(phase: GamePhase): boolean {
  return phase === 'F' || phase === 'FET' || phase === 'FPE'
}

function isLiveNow(phase: GamePhase): boolean {
  return phase !== 'NS' && !isCompleted(phase) && phase !== 'P'
}

export default function MatchCard({ match, isLive }: MatchCardProps) {
  const kickoffDate = new Date(match.kickoff)
  const timeStr = kickoffDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = kickoffDate.toLocaleDateString([], { month: 'short', day: 'numeric' })
  
  const completed = isCompleted(match.phase)
  const live = isLiveNow(match.phase) || isLive

  const statusLabel = completed
    ? 'Completed' 
    : live 
      ? 'Live' 
      : 'Upcoming'

  // Path to redirect: if completed/historical, go to replay page; otherwise go to watch page
  const targetPath = completed ? `/replay/${match.matchId}` : `/match/${match.matchId}`

  return (
    <Link href={targetPath} className="block group">
      <div className="glass-panel p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-cyan-500/20 transition-all duration-300 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-all duration-300" />
        
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-mono text-gray-400" suppressHydrationWarning>
            {dateStr} {timeStr}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
            statusLabel === 'Live'
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
              : statusLabel === 'Completed'
                ? 'bg-gray-850 text-gray-400'
                : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
          }`}>
            {statusLabel}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Home Team */}
          <div className="flex-1 text-right">
            <span className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors font-display block truncate">
              {match.homeTeam}
            </span>
          </div>

          {/* Scores or VS */}
          <div className="flex flex-col items-center justify-center min-w-[75px] px-2 py-1 rounded bg-white/5 border border-white/5">
            {completed || live ? (
              <span className="text-base font-bold font-mono tracking-wider text-white">
                {match.homeScore ?? 0} - {match.awayScore ?? 0}
              </span>
            ) : (
              <span className="text-xs font-semibold text-gray-400 uppercase font-display">
                VS
              </span>
            )}
          </div>

          {/* Away Team */}
          <div className="flex-1 text-left">
            <span className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors font-display block truncate">
              {match.awayTeam}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

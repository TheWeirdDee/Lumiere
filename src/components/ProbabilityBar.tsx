// src/components/ProbabilityBar.tsx
'use client'

import React from 'react'

interface ProbabilityBarProps {
  homeTeam: string
  awayTeam: string
  homeProb: number
  drawProb: number
  awayProb: number
}

export default function ProbabilityBar({ homeTeam, awayTeam, homeProb, drawProb, awayProb }: ProbabilityBarProps) {
  const total = homeProb + drawProb + awayProb
  const homePct = total > 0 ? (homeProb / total) * 100 : 33.3
  const drawPct = total > 0 ? (drawProb / total) * 100 : 33.3
  const awayPct = total > 0 ? (awayProb / total) * 100 : 33.3

  return (
    <div className="glass-panel p-5 rounded-xl space-y-4">
      {/* Label */}
      <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-gray-400 font-display">
        <span>📊 Match Win Chances</span>
        <span>Real-Time Feed</span>
      </div>

      {/* Segmented Glow Bar */}
      <div className="h-6 w-full rounded-full overflow-hidden flex bg-gray-900 border border-white/5 shadow-inner">
        {homePct > 0 && (
          <div 
            style={{ width: `${homePct}%` }}
            className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-500 relative"
          />
        )}
        {drawPct > 0 && (
          <div 
            style={{ width: `${drawPct}%` }}
            className="h-full bg-gray-700 transition-all duration-500"
          />
        )}
        {awayPct > 0 && (
          <div 
            style={{ width: `${awayPct}%` }}
            className="h-full bg-gradient-to-r from-purple-500 to-rose-500 transition-all duration-500"
          />
        )}
      </div>

      {/* Stats Legends */}
      <div className="grid grid-cols-3 gap-4 pt-2">
        {/* Home Team */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-3 h-3 rounded-full bg-cyan-500 flex-shrink-0 glow-cyan" />
          <div className="min-w-0">
            <div className="text-[10px] text-gray-400 font-semibold truncate font-display">{homeTeam}</div>
            <div className="text-sm font-bold text-white">{Math.round(homePct)}%</div>
          </div>
        </div>

        {/* Draw */}
        <div className="flex items-center gap-2.5 justify-center text-center">
          <div className="w-3 h-3 rounded-full bg-gray-500 flex-shrink-0" />
          <div>
            <div className="text-[10px] text-gray-400 font-semibold font-display">Draw</div>
            <div className="text-sm font-bold text-white">{Math.round(drawPct)}%</div>
          </div>
        </div>

        {/* Away Team */}
        <div className="flex items-center gap-2.5 justify-end text-right min-w-0">
          <div className="w-3 h-3 rounded-full bg-purple-500 flex-shrink-0 glow-rose" />
          <div className="min-w-0">
            <div className="text-[10px] text-gray-400 font-semibold truncate font-display">{awayTeam}</div>
            <div className="text-sm font-bold text-white">{Math.round(awayPct)}%</div>
          </div>
        </div>
      </div>
    </div>
  )
}

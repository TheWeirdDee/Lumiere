// src/components/OddsTimeline.tsx
'use client'

import React, { useEffect, useRef } from 'react'
import type { OddsEvent, OddsShock } from '../types'

interface OddsTimelineProps {
  updates: OddsEvent[]
  shocks: OddsShock[]
  homeTeam: string
  awayTeam: string
}

export default function OddsTimeline({ updates, shocks, homeTeam, awayTeam }: OddsTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [updates])

  // Limit rendering to the last 150 items to keep performance snappy
  const renderedUpdates = updates.slice(-150)

  // Match shocks based on rounded timestamps or match identifiers if exact timestamps vary slightly
  const shockTimestamps = new Set(shocks.map(s => s.firedAt))

  return (
    <div className="glass-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 bg-white/5 flex justify-between items-center">
        <h3 className="text-sm font-semibold tracking-wider uppercase text-cyan-400 font-display">
          📈 Real-Time Odds Intelligence
        </h3>
        <span className="text-xs text-gray-400 bg-white/5 px-2.5 py-0.5 rounded-full">
          {updates.length} ticks
        </span>
      </div>

      {/* Timeline Rows */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth"
      >
        {renderedUpdates.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm italic">
            Waiting for betting market feed connection...
          </div>
        ) : (
          renderedUpdates.map((o, idx) => {
            const hasShock = shockTimestamps.has(o.timestamp)
            const timeStr = new Date(o.timestamp).toLocaleTimeString()
            
            return (
              <div 
                key={o.timestamp + '-' + idx} 
                className={`p-3 rounded-lg border transition-all duration-300 ${
                  hasShock 
                    ? 'border-rose-500/40 bg-rose-950/20 shadow-md shadow-rose-950/20' 
                    : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-mono text-gray-400">{timeStr}</span>
                  {hasShock && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded animate-pulse">
                      Shock Fired
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <div className="text-gray-400 truncate font-display">{homeTeam}</div>
                    <div className="font-semibold mt-0.5 text-white">{Math.round(o.homeProb * 100)}%</div>
                  </div>
                  <div>
                    <div className="text-gray-400 font-display">Draw</div>
                    <div className="font-semibold mt-0.5 text-white">{Math.round(o.drawProb * 100)}%</div>
                  </div>
                  <div>
                    <div className="text-gray-400 truncate font-display">{awayTeam}</div>
                    <div className="font-semibold mt-0.5 text-white">{Math.round(o.awayProb * 100)}%</div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

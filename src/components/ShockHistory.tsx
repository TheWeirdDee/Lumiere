// src/components/ShockHistory.tsx
'use client'

import React, { useRef, useEffect } from 'react'
import type { OddsShock } from '../types'

interface ShockHistoryProps {
  shocks: OddsShock[]
  onSelectShock?: (shock: OddsShock) => void
}

export default function ShockHistory({ shocks, onSelectShock }: ShockHistoryProps) {
  const listEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [shocks])

  return (
    <div className="glass-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 bg-white/5 flex justify-between items-center">
        <h3 className="text-sm font-semibold tracking-wider uppercase text-rose-400 font-display">
          🚨 Shock Alerts Timeline
        </h3>
        <span className="text-xs text-gray-400 bg-white/5 px-2.5 py-0.5 rounded-full">
          {shocks.length} alerts
        </span>
      </div>

      {/* Shock Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {shocks.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm italic text-center px-4">
            No market shocks detected yet. Watching for swings ≥ 15%...
          </div>
        ) : (
          shocks.map((s, idx) => {
            const timeStr = new Date(s.firedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            const team = s.affectedTeam === 'home' ? s.homeTeam : s.awayTeam
            const isUp = s.direction === 'up'
            
            return (
              <div 
                key={s.id || idx}
                onClick={() => onSelectShock?.(s)}
                className="group p-4 rounded-lg border border-rose-500/10 bg-rose-950/5 hover:bg-rose-950/10 hover:border-rose-500/30 cursor-pointer transition-all duration-300 relative overflow-hidden"
              >
                {/* Glow Background */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/[0.02] rounded-full blur-xl" />
                
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-mono text-gray-400 font-semibold">
                    {timeStr}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                  }`}>
                    {isUp ? '📈 Swing Up' : '📉 Swing Down'}
                  </span>
                </div>

                <div className="font-display font-semibold text-sm text-white group-hover:text-rose-400 transition-colors">
                  {team} {isUp ? 'rose' : 'dropped'} by {Math.round(s.delta * 100)}%
                </div>
                
                <div className="flex gap-4 text-[10px] text-gray-400 mt-1 mb-2">
                  <div>Before: {Math.round(s.preProb * 100)}%</div>
                  <div>After: {Math.round(s.postProb * 100)}%</div>
                  {s.triggerMinute && <div>Min: {s.triggerMinute}'</div>}
                </div>

                <p className="text-xs text-gray-300 italic line-clamp-2 border-t border-white/5 pt-2 mt-2 leading-relaxed">
                  "{s.explanation || 'No AI commentary generated yet.'}"
                </p>
              </div>
            )
          })
        )}
        <div ref={listEndRef} />
      </div>
    </div>
  )
}

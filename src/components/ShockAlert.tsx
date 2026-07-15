// src/components/ShockAlert.tsx
'use client'

import React, { useEffect } from 'react'
import type { OddsShock } from '../types'

interface ShockAlertProps {
  shock: OddsShock | null
  onClose: () => void
}

export default function ShockAlert({ shock, onClose }: ShockAlertProps) {
  useEffect(() => {
    if (!shock) return
    const timer = setTimeout(() => {
      onClose()
    }, 8000)
    return () => clearTimeout(timer)
  }, [shock, onClose])

  if (!shock) return null

  const isUp = shock.direction === 'up'
  const affectedTeamName = shock.affectedTeam === 'home' ? shock.homeTeam : shock.awayTeam
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 transition-opacity duration-300">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-rose-500/20 bg-gray-950/90 p-8 shadow-2xl shock-flash">
        {/* Glow background */}
        <div className="absolute -inset-10 -z-10 bg-gradient-to-r from-rose-600/10 to-[#f5c518]/10 opacity-40 blur-3xl" />
        
        {/* Close Button & Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 uppercase tracking-widest">
            🚨 Market Shock Alert
          </span>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-full"
            aria-label="Close Alert"
          >
            ✕
          </button>
        </div>

        {/* Match Header */}
        <div className="text-center mb-6">
          <div className="text-xl font-bold tracking-tight text-white font-display">
            {shock.homeTeam} vs {shock.awayTeam}
          </div>
          {shock.triggerMinute && (
            <div className="text-xs text-amber-500 font-semibold mt-1">
              Match Minute: {shock.triggerMinute}'
            </div>
          )}
        </div>

        {/* Delta Card */}
        <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-white/5 border border-white/5 mb-6">
          <div className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#f5c518] to-rose-400 font-display">
            {isUp ? '+' : '-'}{Math.round(shock.delta * 100)}%
          </div>
          <div className="text-sm font-semibold mt-2 text-gray-300">
            Chances Shift for {affectedTeamName}
          </div>
          <div className="flex gap-8 mt-4 text-xs text-gray-400">
            <div>Baseline: {Math.round(shock.preProb * 100)}%</div>
            <div>Post-Shock: {Math.round(shock.postProb * 100)}%</div>
          </div>
        </div>

        {/* AI Insight */}
        <div className="border-t border-white/5 pt-6">
          <div className="text-xs font-semibold text-[#f5c518] uppercase tracking-wider mb-2">
            AI Commentator Commentary
          </div>
          <p className="text-lg italic text-gray-200 leading-relaxed font-display">
            "{shock.explanation || 'Calculating commentary insight...'}"
          </p>
        </div>
      </div>
    </div>
  )
}

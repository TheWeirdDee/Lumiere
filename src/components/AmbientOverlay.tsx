// src/components/AmbientOverlay.tsx — Watching Mode: a quiet second-screen
// companion. Score + live probability bar are always visible; nothing else
// competes for attention until a shock fires a bottom sheet.
'use client'

import React, { useEffect } from 'react'
import type { Fixture, MatchState } from '@/lib/txline/types'
import type { OddsShock } from '@/types'
import ProbabilityBar from './ProbabilityBar'
import TeamFlag from './TeamFlag'

interface AmbientOverlayProps {
  activeFixture: Fixture
  scoresState: MatchState | null
  homeProb: number
  drawProb: number
  awayProb: number
  /** false until the first live odds tick arrives — shows a plain-English hint. */
  hasOdds: boolean
  activeShock: OddsShock | null
  onDismissShock: () => void
}

const AUTO_DISMISS_MS = 8000

export default function AmbientOverlay({
  activeFixture,
  scoresState,
  homeProb,
  drawProb,
  awayProb,
  hasOdds,
  activeShock,
  onDismissShock,
}: AmbientOverlayProps) {
  useEffect(() => {
    if (!activeShock) return
    const timer = setTimeout(onDismissShock, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [activeShock, onDismissShock])

  const team = activeShock ? (activeShock.affectedTeam === 'home' ? activeShock.homeTeam : activeShock.awayTeam) : null
  const buildParams = activeShock ? new URLSearchParams({ matchId: activeShock.matchId, team: activeShock.affectedTeam }) : null

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center px-6 py-24 relative overflow-hidden">
      {/* Score — always visible */}
      <div className="glass-panel w-full max-w-lg px-4 md:px-8 py-6 rounded-3xl border border-white/5 mb-8">
        <div className="flex items-center gap-2 md:gap-5">
          <span className="flex-1 min-w-0 flex items-center justify-end gap-2.5">
            <TeamFlag team={activeFixture.homeTeam} size={26} />
            <span className="text-base md:text-xl font-bold text-white font-display truncate">{activeFixture.homeTeam}</span>
          </span>
          <div className="flex flex-col items-center px-2 md:px-4 shrink-0">
            <span className="text-3xl md:text-5xl font-black font-mono tracking-widest text-white whitespace-nowrap">
              {activeFixture.homeScore ?? 0} - {activeFixture.awayScore ?? 0}
            </span>
            {scoresState && typeof scoresState.minute === 'number' && (
              <span className="text-xs text-amber-500 font-semibold mt-1 whitespace-nowrap">{scoresState.minute}&apos; Minute</span>
            )}
          </div>
          <span className="flex-1 min-w-0 flex items-center gap-2.5">
            <span className="text-base md:text-xl font-bold text-white font-display truncate">{activeFixture.awayTeam}</span>
            <TeamFlag team={activeFixture.awayTeam} size={26} />
          </span>
        </div>
        <div className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-gray-500" suppressHydrationWarning>
          {new Date(activeFixture.kickoff).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Live probability bar — always visible */}
      <div className="w-full max-w-lg">
        <ProbabilityBar
          homeTeam={activeFixture.homeTeam}
          awayTeam={activeFixture.awayTeam}
          homeProb={homeProb}
          drawProb={drawProb}
          awayProb={awayProb}
        />
        {!hasOdds && (
          <p className="mt-4 text-center text-xs text-gray-500 leading-relaxed">
            The chances bar starts moving once the market opens for this match — usually just before kickoff.
            Big moves slide up from the bottom as alerts.{' '}
            <a href="/guide" className="hover:underline" style={{ color: '#f5c518' }}>
              How this works →
            </a>
          </p>
        )}
      </div>

      {/* Tap-outside-to-dismiss backdrop, active only while a shock is showing */}
      {activeShock && (
        <button
          aria-label="Dismiss shock alert"
          onClick={onDismissShock}
          className="fixed inset-0 z-40 cursor-default bg-transparent"
        />
      )}

      {/* Shock bottom sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-500 ease-out transform ${
          activeShock ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {activeShock && team && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl mx-auto bg-gray-950/95 border border-white/10 rounded-t-2xl shadow-2xl p-6 relative"
          >
            <button onClick={onDismissShock} className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors" aria-label="Close">
              ✕
            </button>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-400 uppercase tracking-widest w-fit mb-4">
              🚨 Market Shock Alert
            </div>
            <div className="text-center font-bold text-white font-display text-lg mb-4">
              {activeShock.homeTeam} vs {activeShock.awayTeam}
              {activeShock.triggerMinute && <span className="text-xs text-amber-500 ml-2">({activeShock.triggerMinute}&apos;)</span>}
            </div>
            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 border border-white/5 mb-4">
              <div className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#f5c518] to-rose-400 font-display">
                {activeShock.direction === 'up' ? '+' : '-'}
                {Math.round(activeShock.delta * 100)}%
              </div>
              <div className="text-xs text-gray-300 mt-1">Chances shift for {team}</div>
            </div>
            <div className="text-xs font-semibold text-[#f5c518] uppercase tracking-wider mb-1">AI Commentator</div>
            <p className="text-sm italic text-gray-200 leading-relaxed font-display mb-5">
              &ldquo;{activeShock.explanation || 'Calculating commentary insight...'}&rdquo;
            </p>
            <a
              href={`/build?${buildParams?.toString()}`}
              className="block w-full py-3 rounded-full bg-[#f5c518] hover:bg-[#e2b514] text-black font-display font-bold uppercase tracking-wider text-xs text-center transition-colors"
            >
              Act on this →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

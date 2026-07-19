// src/components/AmbientOverlay.tsx — Watching Mode: a quiet second-screen
// companion. Score + live probability bar are always visible; nothing else
// competes for attention until a shock fires a bottom sheet.
'use client'

import React from 'react'
import type { Fixture, MatchEvent, MatchState, OddsEvent } from '@/lib/txline/types'
import type { OddsShock } from '@/types'
import { inferShockCause, marketTagline } from '@/lib/shock-cause'
import ProbabilityBar from './ProbabilityBar'
import TeamFlag from './TeamFlag'
import FollowFade from './FollowFade'

interface AmbientOverlayProps {
  activeFixture: Fixture
  scoresState: MatchState | null
  homeProb: number
  drawProb: number
  awayProb: number
  /** false until the first live odds tick arrives — shows a plain-English hint. */
  hasOdds: boolean
  /** Most recent odds ticks (newest last) — rendered as the live pulse list. */
  recentUpdates: OddsEvent[]
  /** Match events this session — used to explain what moved the market. */
  matchEvents: MatchEvent[]
  /** Total odds ticks this session. */
  updateCount: number
  latestOdds: OddsEvent | null
  isDemo: boolean
  /** Real auth state — independent of isDemo, which only gates practice scoring. */
  isSignedIn: boolean
  /** Where to return after signing in from inside this overlay (preserves demo/match context). */
  authReturnPath: string
  /** False for demo/replay matches — their TxLINE market is closed, so prefilling
   *  them into the code builder is a guaranteed "no live odds" dead end. */
  canBuildCode: boolean
  feedStatus: 'connecting' | 'live' | 'reconnecting' | 'stale' | 'complete'
  lastFeedAgeSeconds: number | null
  activeShock: OddsShock | null
  onDismissShock: () => void
}

function isCompletedPhase(phase: Fixture['phase']): boolean {
  return phase === 'F' || phase === 'FET' || phase === 'FPE' || phase === 'C'
}

export default function AmbientOverlay({
  activeFixture,
  scoresState,
  homeProb,
  drawProb,
  awayProb,
  hasOdds,
  recentUpdates,
  matchEvents,
  updateCount,
  latestOdds,
  isDemo,
  isSignedIn,
  authReturnPath,
  canBuildCode,
  feedStatus,
  lastFeedAgeSeconds,
  activeShock,
  onDismissShock,
}: AmbientOverlayProps) {
  const team = activeShock ? (activeShock.affectedTeam === 'home' ? activeShock.homeTeam : activeShock.awayTeam) : null
  const buildParams = activeShock ? new URLSearchParams({ matchId: activeShock.matchId, team: activeShock.affectedTeam }) : null
  const shockCause = activeShock ? inferShockCause(activeShock, matchEvents) : null
  const tagline = hasOdds ? marketTagline({ recentUpdates, matchEvents, activeShock, latestOdds }) : null

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

      {/* Live probability bar — always visible; glows briefly while a shock is on screen */}
      <div className="w-full max-w-lg">
        <div
          className={`rounded-xl transition-shadow duration-700 ${
            activeShock ? 'shadow-[0_0_45px_rgba(245,197,24,0.30)]' : 'shadow-none'
          }`}
        >
          <ProbabilityBar
            homeTeam={activeFixture.homeTeam}
            awayTeam={activeFixture.awayTeam}
            homeProb={homeProb}
            drawProb={drawProb}
            awayProb={awayProb}
          />
        </div>
        {tagline && (
          <p
            className={`mt-3 text-center font-mono text-[11px] uppercase tracking-widest transition-colors duration-500 ${
              tagline.mood === 'shock'
                ? 'text-[#f5c518]'
                : tagline.mood === 'reacting' || tagline.mood === 'building'
                  ? 'text-amber-300/80'
                  : 'text-gray-500'
            }`}
          >
            {tagline.text}
          </p>
        )}
        {!hasOdds && (
          <p className="mt-4 text-center text-xs text-gray-500 leading-relaxed">
            {isCompletedPhase(activeFixture.phase)
              ? 'This match is being replayed with its real recorded data — the chances bar comes alive shortly. (The first replay of a match takes a minute to prepare.)'
              : 'The chances bar starts moving once the market opens for this match — usually just before kickoff. Big moves slide up from the bottom as alerts.'}{' '}
            <a href="/guide" className="hover:underline" style={{ color: '#f5c518' }}>
              How this works →
            </a>
          </p>
        )}

        {/* Live pulse — the market ticking between big moments */}
        {hasOdds && recentUpdates.length > 0 && (
          <div className="mt-5 glass-panel rounded-2xl border border-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className='font-mono text-[10px] font-bold uppercase tracking-widest text-gray-500'>TxLINE live market pulse</span>
              <span className={`flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest ${feedStatus === 'live' ? 'text-emerald-400' : feedStatus === 'stale' ? 'text-amber-400' : 'text-rose-300'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${feedStatus === 'live' ? 'bg-emerald-400 animate-pulse' : feedStatus === 'stale' ? 'bg-amber-400' : 'bg-rose-300'}`} />
                {feedStatus === 'live'
                  ? `${updateCount.toLocaleString()} updates${lastFeedAgeSeconds !== null && lastFeedAgeSeconds >= 3 ? ` · ${lastFeedAgeSeconds}s ago` : ''}`
                  : feedStatus === 'stale'
                    ? `stale ${lastFeedAgeSeconds ?? 0}s`
                    : feedStatus}
              </span>
            </div>
            <div className="space-y-1.5">
              {[...recentUpdates].reverse().map((u, idx) => {
                const homeMove = Math.abs(u.deltaHome) >= Math.abs(u.deltaAway)
                const delta = homeMove ? u.deltaHome : u.deltaAway
                const mover = homeMove ? activeFixture.homeTeam : activeFixture.awayTeam
                const steady = Math.abs(delta) < 0.001
                return (
                  <div key={`${u.timestamp}-${idx}`} className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-gray-500" suppressHydrationWarning>
                      {new Date(u.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className={steady ? 'text-gray-500' : delta > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {steady ? 'steady' : `${mover} ${delta > 0 ? '▲' : '▼'} ${(Math.abs(delta) * 100).toFixed(1)}%`}
                    </span>
                    <span className="text-gray-400">
                      {Math.round(u.homeProb * 100)}% · {Math.round(u.drawProb * 100)}% · {Math.round(u.awayProb * 100)}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
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
            className='max-h-[88vh] max-w-2xl mx-auto overflow-y-auto bg-gray-950/95 border border-white/10 rounded-t-2xl shadow-2xl p-6 relative'
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
            {shockCause?.label && (
              <div className="mb-4 flex items-center justify-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-gray-300">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{shockCause.label}</span>
                <span className="text-gray-600">→</span>
                <span className="rounded-full border border-[#f5c518]/25 bg-[#f5c518]/10 px-3 py-1 text-[#f5c518]">⚡ Market shock</span>
              </div>
            )}
            <div className="text-xs font-semibold text-[#f5c518] uppercase tracking-wider mb-1">AI Commentator</div>
            <p className="text-sm italic text-gray-200 leading-relaxed font-display mb-5">
              &ldquo;{activeShock.explanation || shockCause?.narrative || 'Calculating commentary insight...'}&rdquo;
            </p>
            <FollowFade shock={activeShock} latestOdds={latestOdds} isDemo={isDemo} />
            <a
              href={
                !isSignedIn
                  ? `/auth?next=${encodeURIComponent(authReturnPath)}`
                  : canBuildCode
                    ? `/build?${buildParams?.toString()}`
                    : '/build'
              }
              className='mt-3 block w-full py-3 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white font-display font-bold uppercase tracking-wider text-xs text-center transition-colors'
            >
              {!isSignedIn
                ? 'Sign in to build a code →'
                : canBuildCode
                  ? 'Add to a verified code →'
                  : 'Build a real code →'}
            </a>
            {isSignedIn && !canBuildCode && (
              <p className="mt-2 text-center text-[10px] text-gray-500">
                This match already ended — its market is closed, so it can&apos;t be added. Pick a live match in the builder instead.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// src/components/SwipeFeed.tsx
'use client'

import React, { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { Chain, Fixture, MatchEvent, MatchState, OddsEvent } from '@/lib/txline/types'
import type { OddsShock } from '@/types'
import TeamFlag from './TeamFlag'

// Lazy-load the Three.js GoalAnimation overlay to avoid blocking initial load
const GoalAnimation = dynamic(() => import('./GoalAnimation'), { ssr: false })

interface CornerClusterData {
  minute: number
  count: number
  team: Chain | null
}

interface PossessionData {
  minute: number
}

type FeedItem =
  | { id: string; timestamp: number; type: 'goal'; data: MatchEvent }
  | { id: string; timestamp: number; type: 'red_card'; data: MatchEvent }
  | { id: string; timestamp: number; type: 'shock'; data: OddsShock }
  | { id: string; timestamp: number; type: 'corner_cluster'; data: CornerClusterData }
  | { id: string; timestamp: number; type: 'possession'; data: PossessionData }

interface SwipeFeedProps {
  shocks: OddsShock[]
  matchEvents: MatchEvent[]
  activeFixture: Fixture | null
  scoresState: MatchState | null
  /** Most recent odds tick — drives the always-alive market pulse. */
  latestOdds: OddsEvent | null
  /** Total odds ticks received this session — visible proof the feed is alive. */
  updateCount: number
}

const getTeamColor = (teamName: string) => {
  const colors: Record<string, string> = {
    France: '#229ED9',
    Spain: '#f5c518',
    England: '#ffffff',
    Argentina: '#38bdf8',
  }
  return colors[teamName] || '#f5c518'
}

/** A compact live strip: gold/gray/silver chances bar + tick counter. */
function MarketPulse({
  fixture,
  odds,
  updateCount,
}: {
  fixture: Fixture | null
  odds: OddsEvent | null
  updateCount: number
}) {
  if (!odds || !fixture) return null
  const total = odds.homeProb + odds.drawProb + odds.awayProb || 1
  const home = Math.round((odds.homeProb / total) * 100)
  const draw = Math.round((odds.drawProb / total) * 100)
  const away = Math.round((odds.awayProb / total) * 100)

  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-gray-500">Market pulse</span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
        </span>
      </div>
      <div className="h-2 w-full rounded-full overflow-hidden flex bg-gray-900">
        <div className="h-full transition-all duration-500" style={{ width: `${home}%`, background: '#f5c518' }} />
        <div className="h-full bg-gray-700 transition-all duration-500" style={{ width: `${draw}%` }} />
        <div className="h-full transition-all duration-500" style={{ width: `${away}%`, background: '#c8ccd2' }} />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-gray-400">
        <span className="truncate max-w-[38%]">{fixture.homeTeam} {home}%</span>
        <span>Draw {draw}%</span>
        <span className="truncate max-w-[38%] text-right">{fixture.awayTeam} {away}%</span>
      </div>
      <div className="mt-2 text-center font-mono text-[10px] text-gray-600" suppressHydrationWarning>
        {updateCount.toLocaleString()} market updates this session
      </div>
    </div>
  )
}

export default function SwipeFeed({ shocks, matchEvents, activeFixture, scoresState, latestOdds, updateCount }: SwipeFeedProps) {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [addedCodes, setAddedCodes] = useState<Record<string, boolean>>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)

  useEffect(() => {
    const items: FeedItem[] = []

    matchEvents
      .filter((e) => e.type === 'goal')
      .forEach((e) => {
        items.push({ id: `goal-${e.timestamp}-${e.minute}`, timestamp: e.timestamp, type: 'goal', data: e })
      })

    matchEvents
      .filter((e) => e.type === 'red_card')
      .forEach((e) => {
        items.push({ id: `red_card-${e.timestamp}-${e.minute}`, timestamp: e.timestamp, type: 'red_card', data: e })
      })

    shocks.forEach((s) => {
      items.push({ id: `shock-${s.firedAt}`, timestamp: s.firedAt, type: 'shock', data: s })
    })

    // Corner clusters: 3+ corners within a trailing 5-minute window
    const corners = matchEvents.filter((e) => e.type === 'corner').sort((a, b) => a.timestamp - b.timestamp)
    const clusterWindows: number[] = []
    for (const currentCorner of corners) {
      const windowStart = currentCorner.timestamp - 5 * 60_000
      const cornersInWindow = corners.filter((c) => c.timestamp >= windowStart && c.timestamp <= currentCorner.timestamp)
      if (cornersInWindow.length >= 3) {
        const alreadyFired = clusterWindows.some((t) => Math.abs(t - currentCorner.timestamp) < 5 * 60_000)
        if (!alreadyFired) {
          clusterWindows.push(currentCorner.timestamp)
          items.push({
            id: `corner_cluster-${currentCorner.timestamp}`,
            timestamp: currentCorner.timestamp,
            type: 'corner_cluster',
            data: { minute: currentCorner.minute, count: cornersInWindow.length, team: currentCorner.team },
          })
        }
      }
    }

    // Possession Shift: ambient filler card every 10 minutes of match time to
    // keep the feed alive during quiet stretches — no fabricated stats, TxLINE
    // does not expose a possession-percentage field.
    if (scoresState && scoresState.minute > 0) {
      for (let m = 10; m <= scoresState.minute; m += 10) {
        items.push({
          id: `possession-${m}`,
          timestamp: (activeFixture?.kickoff ?? Date.now()) + m * 60_000,
          type: 'possession',
          data: { minute: m },
        })
      }
    }

    items.sort((a, b) => a.timestamp - b.timestamp)
    setFeedItems(items)
  }, [matchEvents, shocks, scoresState, activeFixture])

  // A new card (goal, shock, red card...) arriving should actually be seen —
  // "cards slide in from below" only means something if the viewport moves
  // to reveal them, not just that they exist off-screen in the DOM.
  useEffect(() => {
    if (feedItems.length > prevCountRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
    prevCountRef.current = feedItems.length
  }, [feedItems.length])

  const handleAddCode = (id: string) => {
    setAddedCodes((prev) => ({ ...prev, [id]: true }))
    setTimeout(() => {
      setAddedCodes((prev) => ({ ...prev, [id]: false }))
    }, 2000)
  }

  if (feedItems.length === 0) {
    const phase = activeFixture?.phase
    const upcoming = phase === 'NS' || phase === 'P'
    const finished = phase === 'F' || phase === 'FET' || phase === 'FPE' || phase === 'C'
    const kickoffLabel = activeFixture?.kickoff
      ? new Date(activeFixture.kickoff).toLocaleString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null

    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#080808] text-center select-none px-6">
        <span className="text-4xl md:text-6xl font-black font-display tracking-widest text-white uppercase animate-pulse">
          LUMIÈRE
        </span>

        {activeFixture && (
          <div className="mt-8 flex items-center gap-3">
            <TeamFlag team={activeFixture.homeTeam} size={30} />
            <span className="text-sm font-bold text-white font-display uppercase tracking-wider">
              {activeFixture.homeTeam} <span className="text-gray-500 mx-1">v</span> {activeFixture.awayTeam}
            </span>
            <TeamFlag team={activeFixture.awayTeam} size={30} />
          </div>
        )}

        {kickoffLabel && (
          <p className="mt-2 text-[11px] font-mono uppercase tracking-widest text-gray-500" suppressHydrationWarning>
            {upcoming ? `Kickoff ${kickoffLabel}` : kickoffLabel}
          </p>
        )}

        <div className="mt-8 max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#f5c518' }}>
            {finished ? 'Replay starting — real recorded data' : upcoming ? 'Nothing yet — that’s normal' : 'Connected — waiting for a big moment'}
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            {finished
              ? 'This match already happened, so LUMIÈRE is replaying its real market data from the start. The first cards land within a minute or two — every goal and shock fires exactly where it did in real life.'
              : upcoming
                ? 'This feed fills up once the match kicks off. Every goal, red card and sudden odds move becomes a full-screen card here — you swipe through the drama like a story.'
                : 'Cards appear only when something big happens: a goal, a red card, or the odds moving sharply. Quiet minutes in the match mean a quiet feed — the moment something breaks, it lands here first.'}
          </p>
          <div className="mt-4 flex items-center gap-4">
            <a href="/guide" className="text-[11px] font-bold uppercase tracking-widest hover:underline" style={{ color: '#f5c518' }}>
              How this works →
            </a>
            <a href="/watch?demo=true" className="text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">
              Watch a replay instead
            </a>
          </div>
        </div>

        {/* Proof of life while waiting: the market ticking in real time */}
        <div className="mt-4 w-full flex justify-center">
          <MarketPulse fixture={activeFixture} odds={latestOdds} updateCount={updateCount} />
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-none scroll-smooth bg-black">
      {feedItems.map((item) => (
        <div
          key={item.id}
          className="w-full h-screen snap-start snap-always relative flex flex-col justify-center items-center p-6 text-center select-none overflow-hidden"
        >
          {item.type === 'goal' && <GoalCard event={item.data} activeFixture={activeFixture} scoresState={scoresState} />}
          {item.type === 'red_card' && <RedCardCard event={item.data} />}
          {item.type === 'shock' && (
            <ShockCard shock={item.data} isAdded={!!addedCodes[item.id]} onAdd={() => handleAddCode(item.id)} />
          )}
          {item.type === 'corner_cluster' && <CornerClusterCard cluster={item.data} activeFixture={activeFixture} />}
          {item.type === 'possession' && (
            <PossessionCard possession={item.data} activeFixture={activeFixture} latestOdds={latestOdds} updateCount={updateCount} />
          )}
        </div>
      ))}
    </div>
  )
}

/* ==========================================================================
   GoalCard
   ========================================================================== */
interface GoalCardProps {
  event: MatchEvent
  activeFixture: Fixture | null
  scoresState: MatchState | null
}

function GoalCard({ event, activeFixture, scoresState }: GoalCardProps) {
  const [animating, setAnimating] = useState(true)
  const scoringTeam = event.team === 'home' ? activeFixture?.homeTeam : activeFixture?.awayTeam
  const teamColor = getTeamColor(scoringTeam || '')

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      {animating && (
        <GoalAnimation
          scoringTeam={scoringTeam || 'Team'}
          teamColor={teamColor}
          homeScore={scoresState?.homeScore ?? 0}
          awayScore={scoresState?.awayScore ?? 0}
          onComplete={() => setAnimating(false)}
        />
      )}

      <div
        className="w-full max-w-lg p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden transition-all duration-500 flex flex-col items-center"
        style={{ background: `linear-gradient(135deg, rgba(15,15,15,0.95) 0%, ${teamColor}15 100%)` }}
      >
        <div className="text-xs uppercase tracking-widest font-mono text-[#f5c518] mb-6">Match Incident</div>

        <div className="w-20 h-20 rounded-full bg-[#f5c518]/10 border border-[#f5c518]/25 flex items-center justify-center text-[#f5c518] mb-6">
          <svg className="w-10 h-10 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
          </svg>
        </div>

        <h2 className="text-4xl font-black font-display uppercase tracking-wider text-white">GOAL!</h2>
        <p className="text-sm text-gray-300 font-display mt-2 text-center">
          {scoringTeam} found the net in the {event.minute}&apos; minute!
        </p>

        <div className="mt-8 py-3 px-4 rounded-2xl bg-white/5 border border-white/5 flex gap-3 items-center justify-center font-mono text-lg font-bold tracking-widest text-white shadow-inner w-full">
          <span className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            {activeFixture && <TeamFlag team={activeFixture.homeTeam} size={22} />}
            <span className="truncate">{activeFixture?.homeTeam}</span>
          </span>
          <span className="shrink-0 text-[#f5c518] bg-black/40 px-3 py-1 rounded-lg border border-white/5">
            {scoresState?.homeScore ?? 0} - {scoresState?.awayScore ?? 0}
          </span>
          <span className="flex items-center gap-2 flex-1 min-w-0">
            <span className="truncate">{activeFixture?.awayTeam}</span>
            {activeFixture && <TeamFlag team={activeFixture.awayTeam} size={22} />}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   RedCardCard
   ========================================================================== */
function RedCardCard({ event }: { event: MatchEvent }) {
  const targetTeam = event.team === 'home' ? 'Home side' : 'Away side'
  return (
    <div className="w-full h-full flex items-center justify-center bg-black/40 relative">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="w-[150%] h-36 bg-rose-600/20 rotate-12 diagonal-slash border-t border-b border-rose-500/50" />
      </div>

      <div className="w-full max-w-lg p-8 rounded-3xl border border-rose-950/30 bg-gray-950/80 backdrop-blur-md shadow-2xl relative z-10 flex flex-col items-center">
        <div className="text-xs uppercase tracking-widest font-mono text-rose-500 mb-6">Disciplinary</div>

        <div className="w-16 h-20 rounded-lg bg-rose-600 border-2 border-rose-500 flex items-center justify-center shadow-lg shadow-rose-600/20 mb-6 transform rotate-6">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h2 className="text-4xl font-black font-display uppercase tracking-wider text-rose-500">RED CARD!</h2>
        <p className="text-sm text-gray-300 font-display mt-2 text-center">
          Referee sends off a player in the {event.minute}&apos; minute.
        </p>
        <p className="text-[10px] text-rose-400 font-mono uppercase mt-4 tracking-widest">{targetTeam} down to 10 men</p>
      </div>
    </div>
  )
}

/* ==========================================================================
   ShockCard
   ========================================================================== */
interface ShockCardProps {
  shock: OddsShock
  isAdded: boolean
  onAdd: () => void
}

function ShockCard({ shock, isAdded, onAdd }: ShockCardProps) {
  const team = shock.affectedTeam === 'home' ? shock.homeTeam : shock.awayTeam
  const params = new URLSearchParams({ matchId: shock.matchId, team: shock.affectedTeam })

  return (
    <div className="w-full h-full flex items-center justify-center bg-black/20">
      <div className="w-full max-w-xl p-8 rounded-3xl border border-white/5 bg-zinc-950/90 backdrop-blur-md shadow-2xl relative flex flex-col items-center">
        <div className="text-xs uppercase tracking-widest font-mono text-[#f5c518] mb-6">Market Intelligence</div>

        <div className="w-16 h-16 rounded-2xl bg-[#f5c518]/10 border border-[#f5c518]/25 flex items-center justify-center text-[#f5c518] mb-6">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>

        <h2 className="text-3xl font-black font-display uppercase tracking-wide text-white text-center">Odds Shift on {team}</h2>

        <div className="my-6 py-4 px-6 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center justify-center min-w-[200px]">
          <span className="text-5xl font-black font-mono tracking-tight text-[#f5c518]">
            {shock.direction === 'up' ? '+' : '-'}
            {Math.round(shock.delta * 100)}%
          </span>
          <span className="text-[9px] text-gray-500 uppercase tracking-widest mt-1">swing in {shock.windowSeconds}s</span>
        </div>

        <div className="mb-6 border-t border-white/5 pt-6 text-center w-full">
          <p className="text-base italic text-gray-200 leading-relaxed font-display">
            &ldquo;{shock.explanation || 'Bookmakers reacted instantly to the event.'}&rdquo;
          </p>
        </div>

        <div className="w-full bg-zinc-900 rounded-full h-3 mb-4 overflow-hidden flex">
          <div className="bg-[#f5c518] h-full transition-all duration-500" style={{ width: `${Math.round(shock.preProb * 100)}%` }} />
          <div className="bg-white/20 h-full transition-all duration-500" style={{ width: `${100 - Math.round(shock.preProb * 100)}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-8 w-full">
          <span>Before: {Math.round(shock.preProb * 100)}% chances</span>
          <span>After: {Math.round(shock.postProb * 100)}% chances</span>
        </div>

        <a
          href={`/build?${params.toString()}`}
          onClick={onAdd}
          className={`w-full py-3.5 px-6 rounded-full font-display font-bold uppercase tracking-wider text-xs transition-all duration-200 text-center ${
            isAdded ? 'bg-emerald-500 text-black shadow-md' : 'bg-[#f5c518] hover:bg-[#e2b514] text-black shadow-lg active:scale-98'
          }`}
        >
          {isAdded ? '✓ Opening code builder…' : 'Act on this →'}
        </a>
      </div>
    </div>
  )
}

/* ==========================================================================
   CornerClusterCard
   ========================================================================== */
interface CornerClusterProps {
  cluster: CornerClusterData
  activeFixture: Fixture | null
}

function CornerClusterCard({ cluster, activeFixture }: CornerClusterProps) {
  const teamName = cluster.team === 'home' ? activeFixture?.homeTeam : activeFixture?.awayTeam

  return (
    <div className="w-full h-full flex items-center justify-center relative bg-black/40">
      <div className="absolute top-0 left-0 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />

      <div className="w-full max-w-lg p-8 rounded-3xl border border-amber-500/20 bg-zinc-950/90 backdrop-blur-md shadow-2xl relative z-10 flex flex-col items-center">
        <div className="text-xs uppercase tracking-widest font-mono text-amber-500 mb-6">Pressure Event</div>

        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-6">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21h18M5 21V3l12 4-12 4" />
          </svg>
        </div>

        <h2 className="text-4xl font-black font-display uppercase tracking-wider text-amber-500">Corner Cluster!</h2>
        <p className="text-sm text-gray-300 font-display mt-2 text-center">
          {teamName} is piling on the pressure with {cluster.count} corners in a 5-minute window! ({cluster.minute}&apos; min)
        </p>
        <p className="text-[9px] text-gray-500 font-mono uppercase mt-4 tracking-widest">Continuous offensive play</p>
      </div>
    </div>
  )
}

/* ==========================================================================
   PossessionCard — the "quietest card", but never dead: the pitch may be calm
   while the market keeps ticking, so it carries the live market pulse.
   (No possession percentages — TxLINE's feed has no possession field, so this
   never shows a number it can't back up.)
   ========================================================================== */
interface PossessionProps {
  possession: PossessionData
  activeFixture: Fixture | null
  latestOdds: OddsEvent | null
  updateCount: number
}

function PossessionCard({ possession, activeFixture, latestOdds, updateCount }: PossessionProps) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-3 opacity-80">
        <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
        <p className="text-xs text-gray-400 font-display uppercase tracking-widest text-center">
          {activeFixture?.homeTeam} vs {activeFixture?.awayTeam}
        </p>
        <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
          {possession.minute}&apos; — quiet on the pitch, market still moving
        </p>
      </div>
      <MarketPulse fixture={activeFixture} odds={latestOdds} updateCount={updateCount} />
    </div>
  )
}

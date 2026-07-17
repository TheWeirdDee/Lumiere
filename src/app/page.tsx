// src/app/page.tsx — Landing page. A night match under floodlights: animated
// hero, live ticker, real fixtures with flags, scroll-reveal sections. All
// motion is CSS; flags are SVG; no emoji glyphs anywhere.
'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { Fixture, GamePhase } from '@/lib/txline/types'
import TeamFlag from '@/components/TeamFlag'
import { LogoWordmark } from '@/components/Logo'
import Faq from '@/components/Faq'
import { useAuthUser } from '@/lib/use-auth'

// Hero effects — client-only, loaded lazily so they never block paint.
const LightRays = dynamic(() => import('@/components/reactbits/LightRays/LightRays'), { ssr: false })
const BouncyBalls = dynamic(() => import('@/components/BouncyBalls'), { ssr: false })

const GOLD = '#f5c518'

/* ── Small SVG icon set (no emojis) ─────────────────────────────────────── */

const PlayIcon = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.9l11.05-6.86a1.05 1.05 0 0 0 0-1.8L9.56 4.24A1.05 1.05 0 0 0 8 5.14z" />
  </svg>
)

const BallIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.2 16.4 10.4 14.7 15.6H9.3L7.6 10.4z" />
    <path d="M12 3v4.2M16.4 10.4l4-1.3M14.7 15.6l2.5 3.4M9.3 15.6l-2.5 3.4M7.6 10.4l-4-1.3" />
  </svg>
)

const RedCardIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="7" y="4" width="11" height="16" rx="2" fill="#ff2d2d" transform="rotate(8 12 12)" />
  </svg>
)

const TrendIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
)

const CheckIcon = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

const ClockIcon = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" d="M12 7v5l3 2" />
  </svg>
)

const BoltIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)

const EyeIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)

const TelegramIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.89 1.2-5.33 3.52-.5.35-.96.52-1.37.51-.45-.01-1.32-.26-1.97-.47-.79-.26-1.42-.4-1.37-.85.03-.23.34-.47.95-.71 3.73-1.62 6.21-2.69 7.45-3.21 3.54-1.48 4.27-1.74 4.75-1.75.11 0 .35.03.5.15.13.1.17.24.18.37 0 .04-.01.12-.02.17z" />
  </svg>
)

const ChevronDown = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

/* ── Hero data ──────────────────────────────────────────────────────────── */

interface DemoCard {
  type: 'goal' | 'red_card' | 'shock'
  label: string
  name: string
  team: string
  text: string
  barTeam: string
  barFrom: number
  barTo: number
  tint: string
  border: string
}

const DEMO_CARDS: DemoCard[] = [
  {
    type: 'goal',
    label: 'GOAL',
    name: 'Mbappe',
    team: 'France',
    text: 'France now heavy favourites',
    barTeam: 'France',
    barFrom: 41,
    barTo: 64,
    tint: 'rgba(245, 197, 24, 0.10)',
    border: 'rgba(245, 197, 24, 0.4)',
  },
  {
    type: 'red_card',
    label: 'RED CARD',
    name: 'Upamecano',
    team: 'Morocco',
    text: 'Odds jumped sharply on Morocco',
    barTeam: 'Morocco',
    barFrom: 22,
    barTo: 38,
    tint: 'rgba(255, 45, 45, 0.10)',
    border: 'rgba(255, 45, 45, 0.4)',
  },
  {
    type: 'shock',
    label: 'ODDS SHOCK',
    name: 'Argentina',
    team: 'Argentina',
    text: 'Market moved fast on Argentina',
    barTeam: 'Argentina',
    barFrom: 34,
    barTo: 53,
    tint: 'rgba(0, 230, 118, 0.07)',
    border: 'rgba(0, 230, 118, 0.35)',
  },
]

const CYCLE_MS = 4000

// Deterministic "camera flash" particles — fixed values, no Math.random, so
// server and client render identically.
const FLASHES = [
  { left: '6%', top: '18%', size: 3, delay: '0s' },
  { left: '14%', top: '9%', size: 2, delay: '0.7s' },
  { left: '23%', top: '22%', size: 2, delay: '1.9s' },
  { left: '33%', top: '7%', size: 3, delay: '1.1s' },
  { left: '44%', top: '16%', size: 2, delay: '2.6s' },
  { left: '55%', top: '6%', size: 2, delay: '0.4s' },
  { left: '64%', top: '19%', size: 3, delay: '1.5s' },
  { left: '73%', top: '10%', size: 2, delay: '2.2s' },
  { left: '82%', top: '24%', size: 2, delay: '0.9s' },
  { left: '90%', top: '13%', size: 3, delay: '1.7s' },
  { left: '38%', top: '30%', size: 2, delay: '2.9s' },
  { left: '68%', top: '32%', size: 2, delay: '0.2s' },
]

/* ── Helpers ────────────────────────────────────────────────────────────── */

function isCompleted(phase: GamePhase): boolean {
  return phase === 'F' || phase === 'FET' || phase === 'FPE' || phase === 'C'
}

function isLive(phase: GamePhase): boolean {
  return phase !== 'NS' && phase !== 'P' && !isCompleted(phase)
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] mb-4" style={{ color: GOLD }}>
      {children}
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function HomePage() {
  const [index, setIndex] = useState(0)
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const pageRef = useRef<HTMLDivElement>(null)
  const { user } = useAuthUser()

  // A sign-in link that lands here instead of /auth/callback (e.g. Supabase
  // falling back to the Site URL) leaves ?code= stranded — forward it so the
  // login still completes.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}`)
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % DEMO_CARDS.length), CYCLE_MS)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetch('/api/fixtures')
      .then((r) => r.json())
      .then((d) => setFixtures((d.fixtures || []) as Fixture[]))
      .catch(() => undefined)
  }, [])

  // Scroll-reveal: flip .reveal → .reveal-visible as sections enter the viewport.
  useEffect(() => {
    const nodes = pageRef.current?.querySelectorAll('.reveal')
    if (!nodes || nodes.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible')
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.12 }
    )
    nodes.forEach((n) => observer.observe(n))
    return () => observer.disconnect()
  }, [fixtures.length])

  const card = DEMO_CARDS[index]
  const nextCard = DEMO_CARDS[(index + 1) % DEMO_CARDS.length]

  const sortedMatches = [...fixtures].sort((a, b) => {
    const rank = (f: Fixture) => (isLive(f.phase) ? 0 : f.phase === 'NS' || f.phase === 'P' ? 1 : 2)
    return rank(a) - rank(b) || (rank(a) === 2 ? b.kickoff - a.kickoff : a.kickoff - b.kickoff)
  })
  const shownMatches = sortedMatches.slice(0, 8)

  const tickerItems =
    fixtures.length > 0
      ? sortedMatches.slice(0, 12).map((f) => ({
          key: f.matchId,
          home: f.homeTeam,
          away: f.awayTeam,
          status: isLive(f.phase) ? 'LIVE' : isCompleted(f.phase) ? 'REPLAY' : 'UPCOMING',
        }))
      : []

  return (
    <div ref={pageRef} id="top" className="min-h-screen text-[#f0f0f0] overflow-x-hidden" style={{ background: '#080808' }}>
      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#080808]/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <a href="#top" className="shrink-0">
            <LogoWordmark size={26} textClassName="text-base" />
          </a>
          <nav className="hidden md:flex items-center gap-6 text-[11px] font-bold uppercase tracking-widest text-gray-400">
            <a href="#matches" className="hover:text-white transition-colors">Matches</a>
            <a href="#features" className="hover:text-white transition-colors">What you get</a>
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <Link href="/guide" className="hover:text-white transition-colors">Guide</Link>
          </nav>
          <div className="flex items-center gap-4 shrink-0">
            <Link
              href={user ? '/profile' : '/auth'}
              className="hidden sm:block text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
            >
              {user ? 'My profile' : 'Sign in'}
            </Link>
            <Link
              href="/watch?demo=true"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full font-display text-[11px] font-bold uppercase tracking-widest transition-transform active:scale-95"
              style={{ background: GOLD, color: '#080808' }}
            >
              <PlayIcon className="w-2.5 h-2.5" /> Watch demo
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero: a night match under floodlights ───────────────────── */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden">
        {/* Night sky */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 0%, #0c1210 0%, #080808 55%)' }} />

        {/* Volumetric light rays from the floodlights (WebGL) */}
        <div className="absolute inset-0 pointer-events-none">
          <LightRays
            raysOrigin="top-center"
            raysColor="#f5c518"
            raysSpeed={1}
            lightSpread={1}
            rayLength={2}
            pulsating={false}
            fadeDistance={1}
            saturation={1}
            followMouse
            mouseInfluence={0.1}
            noiseAmount={0}
            distortion={0}
          />
        </div>

        {/* Floodlight beams */}
        <div
          className="floodlight absolute -top-24 -left-32 w-[55rem] h-[34rem] pointer-events-none"
          style={{ background: 'conic-gradient(from 118deg at 0% 0%, rgba(245,197,24,0.16), transparent 26%)', filter: 'blur(28px)' }}
        />
        <div
          className="floodlight absolute -top-24 -right-32 w-[55rem] h-[34rem] pointer-events-none"
          style={{ background: 'conic-gradient(from 208deg at 100% 0%, rgba(245,197,24,0.13), transparent 26%)', filter: 'blur(28px)', animationDelay: '2.2s' }}
        />

        {/* Stadium camera flashes */}
        {FLASHES.map((f, i) => (
          <span
            key={i}
            className="twinkle absolute rounded-full bg-white pointer-events-none"
            style={{ left: f.left, top: f.top, width: f.size, height: f.size, animationDelay: f.delay }}
          />
        ))}

        {/* Pitch in perspective */}
        <div className="absolute bottom-0 left-0 right-0 h-[46%] pointer-events-none" style={{ perspective: '900px' }}>
          <div
            className="absolute inset-x-[-25%] bottom-[-58%] top-0"
            style={{
              transform: 'rotateX(58deg)',
              transformOrigin: 'center bottom',
              background:
                'linear-gradient(to bottom, rgba(0,230,118,0.03), rgba(0,230,118,0.09)), repeating-linear-gradient(to right, rgba(0,230,118,0.05) 0 90px, rgba(0,230,118,0.02) 90px 180px)',
            }}
          >
            <svg className="w-full h-full" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden>
              <g stroke="rgba(0,230,118,0.22)" strokeWidth="2" fill="none">
                <rect x="30" y="20" width="940" height="560" />
                <line x1="500" y1="20" x2="500" y2="580" />
                <circle cx="500" cy="300" r="90" />
                <rect x="30" y="170" width="130" height="260" />
                <rect x="840" y="170" width="130" height="260" />
              </g>
            </svg>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-full" style={{ background: 'linear-gradient(to top, rgba(8,8,8,0.2), #080808 96%)', opacity: 0.55 }} />
        </div>

        {/* A few match balls bouncing on the pitch */}
        <div className="absolute bottom-0 left-0 right-0 h-[26%] pointer-events-none opacity-90">
          <BouncyBalls />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center w-full">
          {/* Left: the pitch talk */}
          <div className="text-center lg:text-left flex flex-col items-center lg:items-start">
            <div className="hero-rise font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-gray-500 mb-6" style={{ animationDelay: '0.05s' }}>
              TxODDS World Cup Hackathon 2026 · Live market data
            </div>
            <h1
              className="hero-rise font-display font-bold uppercase text-white select-none"
              style={{ fontSize: 'clamp(3.5rem, 9vw, 6.5rem)', lineHeight: 0.95, letterSpacing: '-0.01em', textShadow: '0 0 80px rgba(245,197,24,0.25)', animationDelay: '0.15s' }}
            >
              LUMIÈRE
            </h1>
            <p className="hero-rise mt-6 text-xl md:text-2xl text-gray-200 font-display leading-snug" style={{ animationDelay: '0.28s' }}>
              Feel the World Cup.
              <br />
              The odds. The drama. The codes.
            </p>
            <p className="hero-rise mt-6 text-sm md:text-base text-gray-400 leading-relaxed max-w-lg" style={{ animationDelay: '0.4s' }}>
              Your group chat already shares betting codes. LUMIÈRE puts live market intelligence behind them — so
              everyone can see, instantly, whether a pick is smart or just lucky.
            </p>
            <div className="hero-rise mt-9 flex flex-col sm:flex-row items-center gap-4" style={{ animationDelay: '0.52s' }}>
              <Link
                href="/watch?demo=true"
                className="flex items-center gap-2 px-8 py-4 rounded-full font-display font-bold uppercase tracking-widest text-sm transition-transform active:scale-95"
                style={{ background: GOLD, color: '#080808', boxShadow: '0 8px 40px rgba(245,197,24,0.25)' }}
              >
                <PlayIcon /> Watch the live demo
              </Link>
              <Link
                href={user ? '/watch' : '/auth'}
                className="px-8 py-4 rounded-full font-display font-bold uppercase tracking-widest text-sm border border-white/15 text-white hover:bg-white/5 transition-colors"
              >
                {user ? 'Open the app →' : 'Sign in →'}
              </Link>
            </div>
            <div className="hero-rise mt-8 flex items-center gap-8 font-mono" style={{ animationDelay: '0.64s' }}>
              <div className="text-center lg:text-left">
                <div className="text-2xl font-bold text-white">104</div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500">Matches</div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center lg:text-left">
                <div className="text-2xl font-bold text-white">32</div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500">Teams</div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center lg:text-left">
                <div className="text-2xl font-bold" style={{ color: GOLD }}>Every</div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500">Odds tick</div>
              </div>
            </div>
          </div>

          {/* Right: live event card stack */}
          <div className="hero-rise w-full max-w-md mx-auto lg:mx-0 lg:justify-self-end" style={{ animationDelay: '0.45s' }}>
            <div className="relative">
              {/* Card peeking from behind */}
              <div
                className="absolute inset-x-4 -top-3 h-full rounded-3xl border opacity-40"
                style={{ background: nextCard.tint, borderColor: nextCard.border, transform: 'rotate(2deg)' }}
              />
              <div className="relative rounded-3xl border border-white/10 bg-[#0f0f0f]/95 backdrop-blur p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
                <div className="flex items-center justify-between mb-5">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-gray-500">Live match feed</span>
                  <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-rose-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> Live
                  </span>
                </div>

                <div className="h-[7.5rem] relative">
                  <div
                    key={index}
                    className="landing-card absolute inset-0 rounded-2xl border flex items-center gap-4 px-5"
                    style={{ background: card.tint, borderColor: card.border }}
                  >
                    <div className="relative shrink-0">
                      <TeamFlag team={card.team} size={44} />
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0f0f0f] border border-white/15 flex items-center justify-center text-white">
                        {card.type === 'goal' && <BallIcon className="w-3 h-3" />}
                        {card.type === 'red_card' && <RedCardIcon className="w-3 h-3" />}
                        {card.type === 'shock' && <TrendIcon className="w-3 h-3 text-emerald-400" />}
                      </span>
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <div className="text-sm font-bold uppercase tracking-widest text-white font-display">
                        {card.label} — {card.name}
                      </div>
                      <div className="text-sm text-gray-300 mt-1">{card.text}</div>
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-1000"
                            style={{ width: `${card.barTo}%`, background: GOLD }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-gray-400 whitespace-nowrap">
                          {card.barTeam} {card.barFrom}% → <span style={{ color: GOLD }}>{card.barTo}%</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-5 text-xs text-gray-500 leading-relaxed">
                  Every big moment becomes a card like this — with one plain-English line about what the market just did.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <a href="#matches" className="absolute bottom-6 left-1/2 -translate-x-1/2 text-gray-500 hover:text-white transition-colors" aria-label="Scroll to matches">
          <ChevronDown className="bounce-down w-6 h-6" />
        </a>
      </section>

      {/* ── Live ticker ──────────────────────────────────────────────── */}
      <div className="border-y border-white/5 bg-[#050505] overflow-hidden py-3">
        <div className="marquee-track flex items-center gap-10 w-max">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center gap-10">
              {(tickerItems.length > 0 ? tickerItems : [{ key: 'loading', home: 'World Cup 2026', away: 'Live market data', status: 'LIVE' }]).map((t) => (
                <span key={`${dup}-${t.key}`} className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-wider text-gray-400 whitespace-nowrap">
                  <TeamFlag team={t.home} size={16} />
                  {t.home}
                  <span className="text-gray-600">v</span>
                  <TeamFlag team={t.away} size={16} />
                  {t.away}
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      t.status === 'LIVE' ? 'bg-rose-500/15 text-rose-400' : t.status === 'REPLAY' ? 'bg-white/5 text-gray-500' : 'text-black'
                    }`}
                    style={t.status === 'UPCOMING' ? { background: GOLD } : undefined}
                  >
                    {t.status}
                  </span>
                  <span className="text-gray-700">·</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Matches ──────────────────────────────────────────────────── */}
      <section id="matches" className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="reveal text-center max-w-2xl mx-auto mb-12">
            <SectionLabel>The matches</SectionLabel>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white leading-tight">
              Every match. Live or replayed.
            </h2>
            <p className="mt-4 text-sm text-gray-400 leading-relaxed">
              Upcoming matches stream live. Completed ones replay with their real recorded market data — every goal and
              every odds move, exactly as it happened.
            </p>
          </div>

          {shownMatches.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-36 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {shownMatches.map((f, i) => {
                const completed = isCompleted(f.phase)
                const live = isLive(f.phase)
                const href = completed ? `/replay/${f.matchId}` : '/watch'
                const when = new Date(f.kickoff).toLocaleDateString([], { month: 'short', day: 'numeric' })
                return (
                  <Link
                    key={f.matchId}
                    href={href}
                    className="reveal group rounded-2xl border border-white/5 bg-[#0f0f0f] p-5 hover:border-white/20 hover:-translate-y-1 transition-all duration-300"
                    style={{ transitionDelay: `${(i % 4) * 60}ms` }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500" suppressHydrationWarning>
                        {when}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase tracking-wider ${
                          live
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse'
                            : completed
                              ? 'bg-white/5 text-gray-400 border border-white/10'
                              : 'border'
                        }`}
                        style={!live && !completed ? { background: 'rgba(245,197,24,0.12)', color: GOLD, borderColor: 'rgba(245,197,24,0.3)' } : undefined}
                      >
                        {live ? 'Live' : completed ? 'Replay' : 'Upcoming'}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <TeamFlag team={f.homeTeam} size={26} />
                        <span className="text-sm font-semibold text-white font-display truncate group-hover:text-[#f5c518] transition-colors">
                          {f.homeTeam}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 min-w-0">
                        <TeamFlag team={f.awayTeam} size={26} />
                        <span className="text-sm font-semibold text-white font-display truncate group-hover:text-[#f5c518] transition-colors">
                          {f.awayTeam}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">
                      <PlayIcon className="w-2 h-2" /> {completed ? 'Replay the market' : 'Watch live'}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── The problem ──────────────────────────────────────────────── */}
      <section id="problem" className="border-b border-white/5 bg-black/30">
        <div className="max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="reveal">
            <SectionLabel>The problem</SectionLabel>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white leading-tight">
              &ldquo;Here&apos;s my code. Trust me.&rdquo;
            </h2>
            <p className="mt-5 text-sm md:text-base text-gray-400 leading-relaxed max-w-xl">
              Every match day, millions of fans build accumulators on SportyBet, bet9ja and 1xBet and drop the booking
              code in the group chat. No context. No track record. No way to tell a sharp pick from a lucky one — and
              everyone copies it anyway.
            </p>
            <p className="mt-4 text-sm md:text-base text-gray-400 leading-relaxed max-w-xl">
              LUMIÈRE doesn&apos;t take bets and doesn&apos;t hold money. It&apos;s the intelligence layer on top of
              what your group already does.
            </p>
          </div>

          <div className="reveal w-full max-w-md mx-auto lg:mx-0 lg:justify-self-end rounded-3xl border border-white/10 bg-[#0f0f0f] p-6 space-y-3">
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">
              Sunday · the group chat
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-white/5 border border-white/5 px-4 py-3">
              <div className="font-mono text-[10px] font-bold text-[#f5c518] mb-1">@kelvin</div>
              <div className="text-sm text-gray-200">SB code: 7A2K3M — five games, trust me</div>
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-white/5 border border-white/5 px-4 py-3">
              <div className="font-mono text-[10px] font-bold text-rose-400 mb-1">@ade</div>
              <div className="text-sm text-gray-200">last week&apos;s code lost o</div>
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-white/5 border border-white/5 px-4 py-3">
              <div className="font-mono text-[10px] font-bold text-[#f5c518] mb-1">@kelvin</div>
              <div className="text-sm text-gray-200">this one is different, I promise</div>
            </div>
            <div className="pt-2 text-center font-mono text-[10px] uppercase tracking-widest text-gray-600">
              is it, though?
            </div>
          </div>
        </div>
      </section>

      {/* ── What you get ─────────────────────────────────────────────── */}
      <section id="features" className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="reveal text-center max-w-2xl mx-auto mb-14">
            <SectionLabel>What you get</SectionLabel>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white leading-tight">
              Market intelligence, in the language fans actually speak
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="reveal rounded-3xl border border-white/5 bg-[#0f0f0f] p-7 hover:border-white/15 transition-colors">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: 'rgba(245,197,24,0.1)', border: '1px solid rgba(245,197,24,0.25)', color: GOLD }}>
                <BoltIcon />
              </div>
              <h3 className="font-display text-lg font-bold text-white">Odds shock alerts</h3>
              <p className="mt-2.5 text-sm text-gray-400 leading-relaxed">
                When something big happens and the market moves fast, LUMIÈRE fires an alert in one plain-English
                sentence. No trader jargon, ever.
              </p>
              <p className="mt-4 text-sm italic text-gray-300 border-l-2 pl-3" style={{ borderColor: GOLD }}>
                &ldquo;Bookmakers now think France will win after that red card.&rdquo;
              </p>
            </div>

            <div className="reveal rounded-3xl border border-white/5 bg-[#0f0f0f] p-7 hover:border-white/15 transition-colors" style={{ transitionDelay: '60ms' }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                <TrendIcon />
              </div>
              <h3 className='font-display text-lg font-bold text-white'>Verified 1X2 edge on supported codes</h3>
              <p className="mt-2.5 text-sm text-gray-400 leading-relaxed">
                Type in the odds your betting app is offering. LUMIÈRE compares them against the live market and stamps
                each pick green — you&apos;re getting value — or red — the bookmaker has the edge.
              </p>
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <TeamFlag team="France" size={18} />
                <span className="font-mono text-xs text-gray-400">France to win @ 2.10</span>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  +4.2% edge
                </span>
              </div>
            </div>

            <div className="reveal rounded-3xl border border-white/5 bg-[#0f0f0f] p-7 hover:border-white/15 transition-colors">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 bg-rose-500/10 border border-rose-500/25 text-rose-400">
                <EyeIcon />
              </div>
              <h3 className="font-display text-lg font-bold text-white">Live public tracking</h3>
              <p className="mt-2.5 text-sm text-gray-400 leading-relaxed">
                Every shared code gets its own public link. Selections flip to won or lost as the real matches play —
                your whole group watches it happen without leaving the chat.
              </p>
              <div className="mt-4 space-y-2 font-mono text-xs text-gray-300">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400"><CheckIcon /></span> France to win <span className="text-emerald-400 ml-auto">won</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-0.5 mr-1" /> Over 2.5 goals <span className="text-rose-400 ml-auto">live 1-1 · 71&apos;</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500"><ClockIcon /></span> Brazil to win <span className="text-gray-500 ml-auto">pending</span>
                </div>
              </div>
            </div>

            <div className="reveal rounded-3xl border border-white/5 bg-[#0f0f0f] p-7 hover:border-white/15 transition-colors" style={{ transitionDelay: '60ms' }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: 'rgba(34,158,217,0.1)', border: '1px solid rgba(34,158,217,0.3)', color: '#229ED9' }}>
                <TelegramIcon />
              </div>
              <h3 className="font-display text-lg font-bold text-white">A bot inside Telegram</h3>
              <p className="mt-2.5 text-sm text-gray-400 leading-relaxed">
                @LumiereWorldCupBot expands any code link posted in your group with its edge score and live status, and
                pushes the biggest market moves as they happen.
              </p>
              <div className="mt-4 rounded-xl bg-white/5 border border-white/5 px-4 py-3 font-mono text-xs text-gray-300 flex items-center gap-2">
                <span style={{ color: '#229ED9' }}>@LumiereWorldCupBot</span>
                <span className="text-emerald-400"><TrendIcon className="w-3.5 h-3.5" /></span>
                <span className="truncate">ODDS SHOCK — market moved fast on Argentina</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how" className="border-b border-white/5 bg-black/30">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="reveal text-center max-w-2xl mx-auto mb-14">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white leading-tight">
              Watch. Call. Share.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="reveal rounded-3xl border border-white/5 bg-[#0f0f0f] p-7">
              <div className="font-mono text-3xl font-bold mb-4" style={{ color: GOLD }}>01</div>
              <h3 className="font-display text-lg font-bold text-white">Watch a match, your way</h3>
              <p className="mt-2.5 text-sm text-gray-400 leading-relaxed">
                <strong className="text-gray-200">Following mode</strong> is a full-screen swipe feed — goals, red
                cards and market shocks arrive as cards, like TikTok for the match.{' '}
                <strong className="text-gray-200">Watching mode</strong> is a quiet second screen for when the TV is
                on: just the score, the live chances bar, and alerts that slide up when something matters.
              </p>
            </div>
            <div className="reveal rounded-3xl border border-white/5 bg-[#0f0f0f] p-7" style={{ transitionDelay: '80ms' }}>
              <div className="font-mono text-3xl font-bold mb-4" style={{ color: GOLD }}>02</div>
              <h3 className='font-display text-lg font-bold text-white'>Follow or Fade the shock</h3>
              <p className="mt-2.5 text-sm text-gray-400 leading-relaxed">
                A shock fires? Predict whether the move will hold or reverse. Five TxLINE event-minutes later, the
                next eligible market update verifies the result and updates Market IQ. No money and no result guessed by the app.
              </p>
            </div>
            <div className="reveal rounded-3xl border border-white/5 bg-[#0f0f0f] p-7" style={{ transitionDelay: '160ms' }}>
              <div className="font-mono text-3xl font-bold mb-4" style={{ color: GOLD }}>03</div>
              <h3 className="font-display text-lg font-bold text-white">Share it with receipts</h3>
              <p className="mt-2.5 text-sm text-gray-400 leading-relaxed">
                One tap sends your code to Telegram with its edge score attached — plus a live link your friends can
                track until the final whistle. No more &ldquo;trust me.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Glossary for newcomers ───────────────────────────────────── */}
      <section className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="reveal text-center max-w-2xl mx-auto mb-10">
            <SectionLabel>New to this?</SectionLabel>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white leading-tight">
              Three words and you&apos;re fluent
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
            <div className="reveal rounded-2xl border border-white/5 bg-[#0f0f0f] p-6">
              <div className="font-display text-base font-bold text-white mb-2">Code</div>
              <p className="text-sm text-gray-400 leading-relaxed">
                A bundle of picks (an &ldquo;accumulator&rdquo;) your betting app turns into one short, shareable
                booking code.
              </p>
            </div>
            <div className="reveal rounded-2xl border border-white/5 bg-[#0f0f0f] p-6" style={{ transitionDelay: '80ms' }}>
              <div className="font-display text-base font-bold text-white mb-2">Odds</div>
              <p className="text-sm text-gray-400 leading-relaxed">
                The market&apos;s live opinion of what happens next. During a World Cup match they move every few
                seconds.
              </p>
            </div>
            <div className="reveal rounded-2xl border border-white/5 bg-[#0f0f0f] p-6" style={{ transitionDelay: '160ms' }}>
              <div className="font-display text-base font-bold text-white mb-2">Edge</div>
              <p className="text-sm text-gray-400 leading-relaxed">
                The gap between what your bookmaker pays and what the live market says it&apos;s worth. Positive edge
                means you&apos;re getting a good deal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Market IQ ────────────────────────────────────────────────── */}
      <section id="market-iq" className="border-b border-white/5 bg-black/30">
        <div className="max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="reveal">
            <SectionLabel>Market IQ</SectionLabel>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white leading-tight">
              Not &ldquo;did you win&rdquo; —<br />&ldquo;were you right?&rdquo;
            </h2>
            <p className="mt-5 text-sm md:text-base text-gray-400 leading-relaxed max-w-xl">
              Live Follow/Fade calls and verified code outcomes update an immutable Market IQ history. Replay calls
              are practice only. The leaderboard crowns whoever repeatedly reads real market movement, not whoever
              happens to fluke one accumulator.
            </p>
          </div>
          <div className="reveal grid grid-cols-2 gap-4 w-full max-w-md mx-auto lg:mx-0 lg:justify-self-end">
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 text-center">
              <div className="font-mono text-2xl font-bold text-emerald-400">+10</div>
              <div className="mt-1 text-xs text-gray-400">Correct live call</div>
            </div>
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] p-5 text-center">
              <div className="font-mono text-2xl font-bold text-emerald-500/80">0</div>
              <div className="mt-1 text-xs text-gray-400">Close result, push</div>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-center">
              <div className="font-mono text-2xl font-bold text-amber-400">Practice</div>
              <div className="mt-1 text-xs text-gray-400">Replay, no IQ change</div>
            </div>
            <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-5 text-center">
              <div className="font-mono text-2xl font-bold text-rose-400">-5</div>
              <div className="mt-1 text-xs text-gray-400">Wrong live call</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section id="faq" className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="reveal text-center max-w-2xl mx-auto mb-12">
            <SectionLabel>FAQ</SectionLabel>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white leading-tight">
              Every question you were about to ask
            </h2>
            <p className="mt-4 text-sm text-gray-400">
              Want the full walkthrough instead?{' '}
              <Link href="/guide" className="hover:underline" style={{ color: GOLD }}>
                Read the guide →
              </Link>
            </p>
          </div>
          <div className="reveal">
            <Faq />
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(60% 80% at 50% 100%, rgba(245,197,24,0.09), transparent 70%)' }}
        />
        <div className="reveal relative max-w-6xl mx-auto px-6 py-24 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <TeamFlag team="Argentina" size={34} />
            <span className="font-mono text-sm text-gray-400">v</span>
            <TeamFlag team="Egypt" size={34} />
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight">
            See it run on a real World Cup match
          </h2>
          <p className="mt-5 text-sm md:text-base text-gray-400 max-w-xl mx-auto leading-relaxed">
            The demo replays Argentina vs Egypt with the actual recorded market data — the shocks fire exactly where
            they fired live. No account, no setup.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/watch?demo=true"
              className="flex items-center gap-2 px-10 py-4 rounded-full font-display font-bold uppercase tracking-widest text-sm transition-transform active:scale-95"
              style={{ background: GOLD, color: '#080808', boxShadow: '0 8px 40px rgba(245,197,24,0.25)' }}
            >
              <PlayIcon /> Watch the live demo
            </Link>
            <Link
              href="/auth"
              className="px-10 py-4 rounded-full font-display font-bold uppercase tracking-widest text-sm border border-white/15 text-white hover:bg-white/5 transition-colors"
            >
              Create an account →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#050505]">
        <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <LogoWordmark size={22} textClassName="text-sm" />
            <div className="mt-2 font-mono text-[11px] text-gray-600">
              Built for the TxODDS World Cup Hackathon 2026 · Powered by TxLINE live data
            </div>
          </div>
          <div className="flex items-center flex-wrap justify-center gap-6 text-[11px] font-bold uppercase tracking-widest text-gray-400">
            <Link href="/watch?demo=true" className="hover:text-white transition-colors">Live demo</Link>
            <Link href="/guide" className="hover:text-white transition-colors">Guide</Link>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <a href="https://github.com/TheWeirdDee/Lumiere" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              GitHub
            </a>
            <a href="https://t.me/LumiereWorldCupBot" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              Telegram bot
            </a>
            <Link href="/auth" className="hover:text-white transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

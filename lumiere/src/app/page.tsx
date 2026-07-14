// src/app/page.tsx — Landing page. Per spec: no nav, no feature paragraphs,
// no screenshots. The looping mock card IS the product demo.
'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

interface DemoCard {
  icon: string
  label: string
  name: string
  text: string
  background: string
  border: string
}

const DEMO_CARDS: DemoCard[] = [
  {
    icon: '⚽',
    label: 'GOAL',
    name: 'Mbappe',
    text: 'France now heavy favourites',
    background: 'rgba(245, 197, 24, 0.10)',
    border: 'rgba(245, 197, 24, 0.35)',
  },
  {
    icon: '🟥',
    label: 'RED CARD',
    name: 'Upamecano',
    text: 'Odds jumped sharply on Morocco',
    background: 'rgba(255, 45, 45, 0.10)',
    border: 'rgba(255, 45, 45, 0.35)',
  },
  {
    icon: '📈',
    label: 'ODDS SHOCK',
    name: 'Argentina',
    text: 'Market moved fast on Argentina',
    background: '#0f0f0f',
    border: 'rgba(255, 255, 255, 0.1)',
  },
]

const CYCLE_MS = 4000

export default function HomePage() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % DEMO_CARDS.length), CYCLE_MS)
    return () => clearInterval(timer)
  }, [])

  const card = DEMO_CARDS[index]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center" style={{ background: '#080808' }}>
      <h1
        className="font-display font-bold uppercase tracking-tight text-white select-none"
        style={{ fontSize: 'clamp(3rem, 10vw, 7rem)', lineHeight: 1 }}
      >
        LUMIÈRE
      </h1>

      <p className="mt-6 text-base md:text-xl text-gray-300 font-display leading-relaxed">
        Feel the World Cup.
        <br />
        The odds. The drama. The codes.
      </p>

      <div className="mt-12 w-full max-w-sm h-24 relative overflow-hidden">
        <div
          key={index}
          className="landing-card absolute inset-0 rounded-2xl border flex items-center gap-4 px-5"
          style={{ background: card.background, borderColor: card.border }}
        >
          <span className="text-3xl shrink-0">{card.icon}</span>
          <div className="text-left min-w-0">
            <div className="text-xs font-bold uppercase tracking-widest text-white font-display">
              {card.label} — {card.name}
            </div>
            <div className="text-xs text-gray-300 mt-1 truncate">{card.text}</div>
          </div>
        </div>
      </div>

      <Link
        href="/watch"
        className="mt-12 px-10 py-4 rounded-full font-display font-bold uppercase tracking-widest text-sm transition-transform active:scale-95"
        style={{ background: '#f5c518', color: '#080808' }}
      >
        Watch Live →
      </Link>

      <p className="mt-6 text-[11px] text-gray-500 font-mono uppercase tracking-wider">
        Live odds shocks &middot; Code edge scoring &middot; Telegram bot
      </p>
    </div>
  )
}

// /guide — public, no login. Explains the whole app in plain language:
// the two modes, shocks, codes, edge, Market IQ, and replays.
import React from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { LogoWordmark } from '@/components/Logo'
import Faq from '@/components/Faq'

export const metadata: Metadata = {
  title: 'Guide — LUMIÈRE',
  description: 'What LUMIÈRE is, how Following and Watching modes work, what codes and edge scores mean, and how to get the most out of every match.',
}

const GOLD = '#f5c518'

function StepBadge({ n }: { n: string }) {
  return (
    <span className="font-mono text-2xl font-bold" style={{ color: GOLD }}>
      {n}
    </span>
  )
}

export default function GuidePage() {
  return (
    <div className="min-h-screen text-[#f0f0f0]" style={{ background: '#080808' }}>
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#080808]/85 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/">
            <LogoWordmark size={24} textClassName="text-base" />
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/watch?demo=true" className="text-[11px] font-bold uppercase tracking-widest hover:underline" style={{ color: GOLD }}>
              Watch the demo →
            </Link>
            <Link href="/watch" className="text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">
              Open the app
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16 space-y-20">
        {/* Intro */}
        <section className="text-center max-w-2xl mx-auto">
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] mb-4" style={{ color: GOLD }}>
            The guide
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white leading-tight">
            Everything, explained simply
          </h1>
          <p className="mt-5 text-sm md:text-base text-gray-400 leading-relaxed">
            Five minutes here and nothing in the app will confuse you again. No betting knowledge needed — we explain
            every word.
          </p>
        </section>

        {/* The one-sentence version */}
        <section className="rounded-3xl border p-8 md:p-10 text-center" style={{ borderColor: 'rgba(245,197,24,0.3)', background: 'rgba(245,197,24,0.05)' }}>
          <h2 className="font-display text-xl md:text-2xl font-bold text-white leading-snug max-w-2xl mx-auto">
            LUMIÈRE watches the World Cup betting market live, tells you in plain English when it moves — and scores
            the betting codes your friends share so everyone knows if a pick is smart or just lucky.
          </h2>
          <p className="mt-4 text-sm text-gray-400">
            And to be clear: <strong className="text-white">no betting happens here.</strong> No money in, no money
            out. Betting stays on your own betting app; LUMIÈRE is the brain beside it.
          </p>
        </section>

        {/* The two modes */}
        <section>
          <div className="text-center mb-10">
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] mb-3" style={{ color: GOLD }}>
              Two ways to follow a match
            </div>
            <h2 className="font-display text-3xl font-bold text-white">Following vs Watching</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-white/5 bg-[#0f0f0f] p-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: GOLD, color: '#080808' }}>
                  Following
                </span>
                <span className="text-[11px] font-mono uppercase tracking-widest text-gray-500">Can&apos;t watch the game</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                A full-screen feed you <strong className="text-gray-200">swipe like TikTok</strong>. Every big moment —
                a goal, a red card, a sudden market move — becomes one dramatic card. You&apos;re at work, on the bus,
                in a lecture? Swipe through the match like a story.
              </p>
              <div className="mt-5 rounded-xl bg-white/[0.03] border border-white/5 p-4">
                <p className="text-xs text-gray-500 leading-relaxed">
                  <strong className="text-gray-300">Quiet feed?</strong> That&apos;s the match being quiet, not the app
                  being broken. Cards exist only for real moments — when something breaks, it lands here within
                  seconds.
                </p>
              </div>
            </div>
            <div className="rounded-3xl border border-white/5 bg-[#0f0f0f] p-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/20 text-white">
                  Watching
                </span>
                <span className="text-[11px] font-mono uppercase tracking-widest text-gray-500">Game is on your TV</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                A <strong className="text-gray-200">quiet second screen</strong>. Just the score and a live bar showing
                each team&apos;s chances — nothing competing with the TV. When the market makes a big move, an alert
                slides up from the bottom, stays 8 seconds, and gets out of your way.
              </p>
              <div className="mt-5 rounded-xl bg-white/[0.03] border border-white/5 p-4">
                <p className="text-xs text-gray-500 leading-relaxed">
                  <strong className="text-gray-300">Bar not moving?</strong> The market opens just before kickoff — the
                  chances bar comes alive the moment real odds start flowing.
                </p>
              </div>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-gray-500">
            Switch anytime with the two pills at the top of the watch screen — LUMIÈRE remembers your choice.
          </p>
        </section>

        {/* The core loop */}
        <section>
          <div className="text-center mb-10">
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] mb-3" style={{ color: GOLD }}>
              The core of the app
            </div>
            <h2 className="font-display text-3xl font-bold text-white">From a big moment to a shared code</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="rounded-3xl border border-white/5 bg-[#0f0f0f] p-6">
              <StepBadge n="01" />
              <h3 className="mt-3 font-display text-base font-bold text-white">A shock fires</h3>
              <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                A goal or red card makes the market suddenly change its mind — a team&apos;s chances jump 15%+ in
                seconds. LUMIÈRE catches it and tells you in one plain sentence: <em className="text-gray-300">&ldquo;Bookmakers now
                think France will win after that red card.&rdquo;</em>
              </p>
            </div>
            <div className="rounded-3xl border border-white/5 bg-[#0f0f0f] p-6">
              <StepBadge n="02" />
              <h3 className="mt-3 font-display text-base font-bold text-white">You act on it</h3>
              <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                Tap <strong className="text-gray-200">Act on this →</strong> and the pick is pre-filled in the code
                builder. Type the odds your betting app is currently offering for that same pick.
              </p>
            </div>
            <div className="rounded-3xl border border-white/5 bg-[#0f0f0f] p-6">
              <StepBadge n="03" />
              <h3 className="mt-3 font-display text-base font-bold text-white">LUMIÈRE scores it</h3>
              <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                Instantly you see your <strong className="text-gray-200">edge</strong>: green means your app&apos;s
                price beats the live market — a good deal. Red means the bookmaker has the edge. Now you know before
                you commit to anything.
              </p>
            </div>
            <div className="rounded-3xl border border-white/5 bg-[#0f0f0f] p-6">
              <StepBadge n="04" />
              <h3 className="mt-3 font-display text-base font-bold text-white">Share with receipts</h3>
              <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                One tap sends the code to your group with its edge score attached — plus a public link where everyone
                watches each pick flip to <span className="text-emerald-400">won</span> or{' '}
                <span className="text-rose-400">lost</span> live. No more &ldquo;trust me.&rdquo;
              </p>
            </div>
          </div>
        </section>

        {/* Market IQ + replays */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-white/5 bg-[#0f0f0f] p-8">
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] mb-3" style={{ color: GOLD }}>
              Market IQ
            </div>
            <h3 className="font-display text-xl font-bold text-white">Being right beats being lucky</h3>
            <p className="mt-3 text-sm text-gray-400 leading-relaxed">
              Every resolved code updates your score: a smart pick that won is <span className="text-emerald-400 font-mono">+15</span>,
              a smart pick that lost unluckily still earns <span className="text-emerald-400 font-mono">+5</span>, a lucky guess costs{' '}
              <span className="text-amber-400 font-mono">−5</span>, and a bad pick that lost costs{' '}
              <span className="text-rose-400 font-mono">−10</span>. The leaderboard crowns whoever actually reads the
              market best across the tournament.
            </p>
          </div>
          <div className="rounded-3xl border border-white/5 bg-[#0f0f0f] p-8">
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] mb-3" style={{ color: GOLD }}>
              Replays
            </div>
            <h3 className="font-display text-xl font-bold text-white">Finished matches, real data</h3>
            <p className="mt-3 text-sm text-gray-400 leading-relaxed">
              Any completed match can be replayed with its <strong className="text-gray-200">actual recorded market
              data</strong> — every goal and odds move exactly where it happened, played back at 5x. It&apos;s not a
              simulation; it&apos;s the match&apos;s real story retold. Perfect for feeling how a shock works without
              waiting for a live game.
            </p>
            <Link href="/watch?demo=true" className="inline-block mt-4 text-xs font-bold uppercase tracking-widest hover:underline" style={{ color: GOLD }}>
              Try a replay now — no account →
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section>
          <div className="text-center mb-10">
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] mb-3" style={{ color: GOLD }}>
              Still wondering
            </div>
            <h2 className="font-display text-3xl font-bold text-white">Questions, answered</h2>
          </div>
          <Faq />
        </section>

        {/* CTA */}
        <section className="text-center pb-8">
          <Link
            href="/watch?demo=true"
            className="inline-block px-10 py-4 rounded-full font-display font-bold uppercase tracking-widest text-sm transition-transform active:scale-95"
            style={{ background: GOLD, color: '#080808', boxShadow: '0 8px 40px rgba(245,197,24,0.25)' }}
          >
            Watch the live demo
          </Link>
        </section>
      </main>
    </div>
  )
}

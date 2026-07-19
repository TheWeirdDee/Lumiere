// /docs — public, no login. Technical documentation for judges, integrators
// and future contributors: architecture, data flow, TxLINE surface, security
// model, and verification. Consumer explanation lives at /guide instead.
import React from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { LogoWordmark } from '@/components/Logo'

export const metadata: Metadata = {
  title: 'Technical Docs — LUMIÈRE',
  description: 'Architecture, TxLINE integration, shock detection, Market IQ scoring rules, security model and verification for LUMIÈRE.',
}

const GOLD = '#f5c518'

function Section({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-6">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] mb-2" style={{ color: GOLD }}>
          {label}
        </div>
        <h2 className="font-display text-2xl md:text-3xl font-bold text-white">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/5 bg-[#0f0f0f] p-6 ${className}`}>{children}</div>
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[13px] text-[#f5c518]">{children}</code>
}

export default function DocsPage() {
  return (
    <div className="min-h-screen text-[#f0f0f0]" style={{ background: '#080808' }}>
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#080808]/85 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/">
            <LogoWordmark size={24} textClassName="text-base" />
          </Link>
          <div className="flex items-center gap-5">
            <a
              href="https://github.com/TheWeirdDee/Lumiere"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
            >
              GitHub
            </a>
            <Link href="/guide" className="text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">
              User guide
            </Link>
            <Link href="/watch?demo=true" className="text-[11px] font-bold uppercase tracking-widest hover:underline" style={{ color: GOLD }}>
              Watch the demo →
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16 space-y-20">
        <section className="text-center max-w-2xl mx-auto">
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] mb-4" style={{ color: GOLD }}>
            Technical documentation
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white leading-tight">How LUMIÈRE is built</h1>
          <p className="mt-5 text-sm md:text-base text-gray-400 leading-relaxed">
            Architecture, the TxLINE surface LUMIÈRE depends on, the shock detector and Market IQ rules, the security
            model, and how to verify all of it yourself. Built for the TxODDS World Cup Hackathon 2026, Consumer &amp;
            Fan Experiences track.
          </p>
        </section>

        <Section label="01 · Core loop" title="One pipeline, live and replay">
          <Card>
            <pre className="whitespace-pre-wrap font-mono text-xs md:text-[13px] text-gray-300 leading-relaxed">
{`TxLINE odds SSE (or recorded replay events)
  -> normalized full-match 1X2 probability
  -> 15 percentage-point / 90-second shock detector
  -> Follow or Fade fan call
  -> first TxLINE 1X2 tick after five event-minutes
  -> immutable Market IQ event
  -> profile, leaderboard and Telegram result`}
            </pre>
            <p className="mt-4 text-sm text-gray-400 leading-relaxed">
              Live streams and recorded replay both pass through the identical normalizers, shock detector and
              Follow/Fade resolution logic in <Mono>src/lib/txline</Mono>. Replay is not a scripted animation — it
              rebuilds match state from recorded TxLINE events in their original order, which is why the guest demo
              can reproduce the exact same shocks that fired during the live match.
            </p>
          </Card>
        </Section>

        <Section label="02 · Architecture" title="Where the logic lives">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card>
              <h3 className="font-display text-base font-bold text-white mb-2">Live path</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                <Mono>/api/scores-relay</Mono> and <Mono>/api/odds-relay</Mono> are server-sent-event routes that
                subscribe to TxLINE&apos;s streams, normalize each update, run shock detection, and forward events to
                every connected browser and any Telegram group following that fixture.
              </p>
            </Card>
            <Card>
              <h3 className="font-display text-base font-bold text-white mb-2">Replay path</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                <Mono>/api/replay</Mono> streams recorded TxLINE history through the same pipeline at configurable
                speed, with resumable playback via <Mono>startAt</Mono> / SSE <Mono>Last-Event-ID</Mono> so a client
                reconnect (or app navigation) picks up mid-match instead of restarting.
              </p>
            </Card>
            <Card>
              <h3 className="font-display text-base font-bold text-white mb-2">Shock detector</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                <Mono>src/lib/shock-detector.ts</Mono> tracks a rolling 90-second window per side. A shock fires when
                a home or away Match Winner probability moves at least 15 percentage points inside that window; the
                window resets on fire to prevent duplicate triggers. Detector instances are created per SSE session so
                concurrent viewers and replay reconnects never share state.
              </p>
            </Card>
            <Card>
              <h3 className="font-display text-base font-bold text-white mb-2">Two client modes</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                <strong className="text-gray-200">Following Mode</strong> (<Mono>SwipeFeed.tsx</Mono>) renders goals,
                red cards and shocks as a full-screen scroll-snap feed.{' '}
                <strong className="text-gray-200">Watching Mode</strong> (<Mono>AmbientOverlay.tsx</Mono>) is a
                persistent scoreboard and probability bar with shocks as bottom sheets. Both consume the same SSE
                stream from <Mono>src/app/watch/page.tsx</Mono>.
              </p>
            </Card>
          </div>
        </Section>

        <Section label="03 · Market IQ" title="Scoring and integrity rules">
          <Card>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="font-mono text-2xl font-bold text-emerald-400">+10</div>
                <div className="mt-1 text-[11px] text-gray-500 uppercase tracking-wider">Correct live call</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-2xl font-bold text-rose-400">−5</div>
                <div className="mt-1 text-[11px] text-gray-500 uppercase tracking-wider">Wrong live call</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-2xl font-bold text-gray-300">0</div>
                <div className="mt-1 text-[11px] text-gray-500 uppercase tracking-wider">Push (too close)</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-2xl font-bold text-amber-400">n/a</div>
                <div className="mt-1 text-[11px] text-gray-500 uppercase tracking-wider">Replay (practice)</div>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Entry probability is read from the persisted shock, never from a client-supplied value. Resolution uses
              the first valid TxLINE Match Winner update at least five event-minutes after the shock fired. Every
              score change is tied to a unique source event via database constraints in{' '}
              <Mono>supabase/schema.sql</Mono>, so reconnects, concurrent relays and repeated requests cannot award
              the same result twice. Replay calls resolve locally for the visiting browser and never touch the
              leaderboard.
            </p>
          </Card>
        </Section>

        <Section label="04 · TxLINE surface" title="Endpoints this app depends on">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 border-b border-white/10">
                    <th className="pb-3 pr-4 font-semibold">TxLINE path</th>
                    <th className="pb-3 font-semibold">Use</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  {[
                    ['GET /fixtures/snapshot', 'World Cup fixtures, participants and team orientation'],
                    ['GET /scores/stream', 'Live score state and match events'],
                    ['GET /odds/stream', 'Live consensus odds, shock detection and Follow/Fade resolution'],
                    ['GET /scores/snapshot/{fixtureId}', 'Current or final score state and settlement recovery'],
                    ['GET /odds/snapshot/{fixtureId}', 'Current Match Winner probabilities and edge verification'],
                    ['GET /scores/historical/{fixtureId}', 'Historical score records when available'],
                    ['GET /scores/updates/{epochDay}/{hour}/{interval}', 'Time-bucket replay fallback for score data'],
                    ['GET /odds/updates/{epochDay}/{hour}/{interval}', 'Time-bucket replay fallback for odds data'],
                  ].map(([path, use]) => (
                    <tr key={path} className="border-b border-white/5 last:border-0">
                      <td className="py-2.5 pr-4 font-mono text-xs text-[#f5c518] whitespace-nowrap">{path}</td>
                      <td className="py-2.5 text-xs md:text-sm">{use}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-gray-500 leading-relaxed">
              These are upstream TxLINE paths called server-side, not LUMIÈRE&apos;s own browser routes. Both live
              streams and replay records pass through the same normalizers in <Mono>src/lib/txline</Mono>.
            </p>
          </Card>
        </Section>

        <Section label="05 · Security & integrity" title="What the server never trusts from the client">
          <Card>
            <ul className="space-y-2.5 text-sm text-gray-400">
              {[
                'TxLINE, Supabase service-role, Telegram and Groq credentials are server-only, never exposed via NEXT_PUBLIC_ variables.',
                'Code creation recomputes probability and edge from TxLINE; client-supplied edge values are never trusted.',
                'Selection settlement is derived from final TxLINE score states — there is no public settlement endpoint.',
                'Follow/Fade entry probability comes from the persisted shock; resolution probability comes from a future TxLINE event.',
                'Database unique constraints make shocks, market calls, IQ events and Telegram broadcasts idempotent.',
                'Live calls close after 30 seconds. Replay calls are local practice and cannot affect Market IQ or the leaderboard.',
                'Unsupported market schemas are hidden instead of estimated — LUMIÈRE never invents a number it cannot verify.',
                'Telegram login codes are signed, browser-bound, and expire after ten minutes.',
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: GOLD }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Section>

        <Section label="06 · Stack" title="Built with">
          <Card>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>Next.js 16.2, React 19, TypeScript, Tailwind CSS</li>
              <li>TxLINE Service Level 12 mainnet data</li>
              <li>Supabase Auth and Postgres</li>
              <li>Telegram Bot API with a Vercel webhook</li>
              <li>Groq for one-sentence shock explanations, with a deterministic fallback</li>
              <li>Solana activation through <Mono>scripts/activate.ts</Mono></li>
            </ul>
          </Card>
        </Section>

        <Section label="07 · Verification" title="Run it yourself">
          <Card>
            <pre className="whitespace-pre-wrap font-mono text-xs md:text-[13px] text-gray-300 leading-relaxed">
{`npm run typecheck
npm run test:market-calls
npm run test:replay-integrity
npm run test:replay-route
npm run test:replay-soak
npm run build`}
            </pre>
            <p className="mt-4 text-sm text-gray-400 leading-relaxed">
              These cover TypeScript correctness, Follow/Fade settlement rules, recorded-event integrity, replay route
              resume behavior, accelerated replay reliability under load, and a production build. Full setup steps are
              in the repository <Mono>README.md</Mono>.
            </p>
          </Card>
        </Section>

        <section className="text-center pb-8">
          <a
            href="https://github.com/TheWeirdDee/Lumiere"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-10 py-4 rounded-full font-display font-bold uppercase tracking-widest text-sm border border-white/15 text-white hover:bg-white/5 transition-colors"
          >
            View source on GitHub →
          </a>
        </section>
      </main>
    </div>
  )
}

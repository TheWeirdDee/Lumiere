// Shared FAQ accordion — used on the landing page and the /guide page.
import React from 'react'

const GOLD = '#f5c518'

interface FaqItem {
  q: string
  a: React.ReactNode
}

const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Do I actually bet on LUMIÈRE?',
    a: 'No — and this matters. LUMIÈRE never takes your money, never places a bet, and has no wallet. Betting (if you choose to) happens on your own betting app, like SportyBet or bet9ja. LUMIÈRE is the intelligence sitting next to that: it tells you whether the picks in a code are smart before anyone plays them.',
  },
  {
    q: 'Is it free?',
    a: 'Completely. No subscription, no card, nothing to unlock.',
  },
  {
    q: 'What exactly is a "code"?',
    a: 'When someone builds a set of picks on a betting app (say, "France to win + Over 2.5 goals + Brazil to win"), the app bundles it into one short booking code that friends can copy — that\'s what people share in group chats. On LUMIÈRE, a code is that same bundle plus intelligence: each pick gets an edge score, and the whole code gets a public link that updates live as the matches play.',
  },
  {
    q: 'What are "odds", in plain words?',
    a: 'Odds are the betting market\'s live opinion about what happens next — like a price that moves. If France score, the market instantly thinks France are more likely to win, and the odds move. During a World Cup match they change every few seconds.',
  },
  {
    q: 'What is an "edge score"?',
    a: 'It\'s the gap between what your betting app is offering you and what the live market says the pick is really worth. Positive edge (green) means you\'re getting a better deal than the market rate. Negative edge (red) means the bookmaker has priced it against you. It doesn\'t predict the future — it tells you if the price is fair.',
  },
  {
    q: 'What is an "odds shock"?',
    a: 'When a team\'s chance of winning jumps or drops by 15% or more within 90 seconds — usually right after a goal or a red card — LUMIÈRE fires an alert with one plain-English sentence about what the market just decided. That alert has an "Act on this" button that pre-fills a pick for you.',
  },
  {
    q: 'Where does the data come from?',
    a: 'From TxLINE by TxODDS — a live feed of scores and consensus betting-market odds for every World Cup match, the same class of data professional trading desks use. LUMIÈRE reads it in real time and translates it into fan language.',
  },
  {
    q: 'Is the replay a simulation?',
    a: 'No. A replay is the match\'s actual recorded market data — every goal and every odds move, exactly as it happened, played back (usually at 5x speed). Nothing is invented; the shocks fire at the exact moments they fired in real life.',
  },
  {
    q: 'Why does the feed say "waiting for kickoff"?',
    a: 'Cards only appear when something big happens: a goal, a red card, or a sharp market move. Before kickoff — or during a quiet stretch of the match — there\'s simply nothing to show yet. If you want action right now, open a replay of a finished match instead: it\'s full of real moments.',
  },
  {
    q: 'What are Following and Watching modes?',
    a: 'Following mode is for when you can\'t watch the match: a full-screen feed you swipe through like TikTok, one big moment per card. Watching mode is for when the match is on your TV: a quiet second screen showing just the score and the live chances bar, with alerts sliding up only when something matters.',
  },
  {
    q: 'What is Market IQ?',
    a: 'A score that measures whether you read the market well — not just whether you won. A smart pick that wins earns +15; a smart pick that loses unluckily still earns +5; a lucky guess costs −5; a bad pick that loses costs −10. The leaderboard ranks the sharpest readers of the market, not the luckiest.',
  },
  {
    q: 'Why is there no Telegram login button sometimes?',
    a: 'Telegram itself only shows its login button on the app\'s officially registered website domain. If you\'re on a preview or local copy, use Email instead — on the real site it appears normally.',
  },
  {
    q: 'Do I need Telegram to use LUMIÈRE?',
    a: 'No. Telegram makes sharing effortless (and @LumiereWorldCupBot can expand codes right inside your group), but you can sign in with email and share code links anywhere — WhatsApp, iMessage, wherever your group lives.',
  },
  {
    q: 'Can I use LUMIÈRE without betting at all?',
    a: 'Absolutely. Plenty of people just want to feel the match: the swipe feed, the goal moments, and the market\'s live mood are a genuinely fun way to follow a game even if you never touch a betting app.',
  },
]

export default function Faq() {
  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {FAQ_ITEMS.map((item) => (
        <details
          key={item.q}
          className="group rounded-2xl border border-white/5 bg-[#0f0f0f] open:border-[#f5c518]/25 transition-colors"
        >
          <summary className="flex items-center justify-between gap-4 cursor-pointer select-none list-none px-6 py-4 [&::-webkit-details-marker]:hidden">
            <span className="text-sm font-semibold text-white font-display">{item.q}</span>
            <span
              className="shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-transform group-open:rotate-45"
              style={{ borderColor: 'rgba(245,197,24,0.4)', color: GOLD }}
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </summary>
          <div className="px-6 pb-5 text-sm text-gray-400 leading-relaxed">{item.a}</div>
        </details>
      ))}
    </div>
  )
}

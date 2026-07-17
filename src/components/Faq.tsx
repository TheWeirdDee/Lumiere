import React from 'react'

const GOLD = '#f5c518'

interface FaqItem {
  q: string
  a: React.ReactNode
}

const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Do I bet on LUMIERE?',
    a: 'No. LUMIERE never accepts money or places a wager. It is a second-screen market game and intelligence tool. Any bookmaker action happens separately and remains your decision.',
  },
  {
    q: 'What is Follow or Fade?',
    a: 'After a large market shock, Follow predicts that at least half of the move will still hold five match minutes later. Fade predicts that it will reverse. The first eligible TxLINE 1X2 update resolves the call.',
  },
  {
    q: 'Does a replay affect Market IQ?',
    a: 'No. Replays use real recorded TxLINE events and the same resolution formula, but they are clearly treated as practice. Only time-limited calls made on a live shock can change the leaderboard.',
  },
  {
    q: 'What is Market IQ?',
    a: 'An auditable score built from TxLINE-verified calls and supported code selections. A correct live Follow/Fade call earns 10 points, a wrong call loses 5, and a close result is a push. Every award has a unique server-side event so reconnects cannot score twice.',
  },
  {
    q: 'What is an odds shock?',
    a: 'A team win probability moving by at least 15 percentage points inside a rolling 90-second TxLINE window. LUMIERE stores the before value, after value, affected team, event time and explanation.',
  },
  {
    q: 'Which edge markets are verified?',
    a: 'Match Winner only: home win, draw or away win. LUMIERE hides goals and both-teams-to-score edge scoring until those TxLINE fields are verified instead of guessing their schema.',
  },
  {
    q: 'How do public codes update?',
    a: 'TxLINE score states settle supported selections on the server at full time. Public pages poll the verified result, and Telegram groups that expanded the code receive its final status.',
  },
  {
    q: 'Where does the data come from?',
    a: 'TxLINE by TxODDS. The interface shows feed health, event timestamps and update counts so you can distinguish a live connection, a reconnect and a stale feed.',
  },
  {
    q: 'How does Telegram login work?',
    a: 'Open @LumiereWorldCupBot from the sign-in page and tap Start. The bot sends a signed LUM1 code that expires after ten minutes and only works in the browser that requested it. It is not an SMS or Telegram phone-number code.',
  },
  {
    q: 'What can the Telegram bot do?',
    a: 'It expands LUMIERE code links, returns current TxLINE 1X2 odds with /odds, shows recent shocks, displays the Market IQ leaderboard and lets groups subscribe with /followmatch.',
  },
  {
    q: 'Is the replay simulated?',
    a: 'No. It is recorded TxLINE scores and odds passed through the same normalizer, shock detector and Follow/Fade rules as live data. Demo playback is accelerated so the complete loop fits in a short walkthrough.',
  },
  {
    q: 'Is LUMIERE free?',
    a: 'The fan experience is currently free. Affiliate destinations and sponsored shock slots appear only after approved partner settings are configured; no paid tipster subscription is currently sold.',
  },
]

export default function Faq() {
  return (
    <div className='mx-auto max-w-3xl space-y-3'>
      {FAQ_ITEMS.map((item) => (
        <details key={item.q} className='group rounded-2xl border border-white/5 bg-[#0f0f0f] transition-colors open:border-[#f5c518]/25'>
          <summary className='flex cursor-pointer list-none select-none items-center justify-between gap-4 px-6 py-4 [&::-webkit-details-marker]:hidden'>
            <span className='font-display text-sm font-semibold text-white'>{item.q}</span>
            <span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-transform group-open:rotate-45' style={{ borderColor: 'rgba(245,197,24,0.4)', color: GOLD }}>
              <svg className='h-3 w-3' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
                <path strokeLinecap='round' d='M12 5v14M5 12h14' />
              </svg>
            </span>
          </summary>
          <div className='px-6 pb-5 text-sm leading-relaxed text-gray-400'>{item.a}</div>
        </details>
      ))}
    </div>
  )
}

# LUMIÈRE

**The market intelligence layer for World Cup codes.**

LUMIÈRE puts TxLINE's live odds data behind the betting codes you already share with your friends. Build smarter accumulators. Share them with verified market edge scores. Track performance live. Get shocked when the market moves — and build your next selection from it.

Built for the TxODDS World Cup Hackathon · Consumer & Fan Experiences Track · July 2026

---

## The Problem

Every day during the World Cup, millions of fans build accumulators on SportyBet, bet9ja, 1xBet, and 247Bet and share the booking codes in Telegram and WhatsApp groups. The problem: nobody knows if the selections are actually smart. There's no context, no market intelligence, no track record behind the code.

## What LUMIÈRE Does

**Odds shock alerts:** When win probability shifts more than 15% in 90 seconds, LUMIÈRE fires a full-screen alert — what moved, how fast, and a plain-English AI explanation. Each shock has an "Add to Code" button — the market movement becomes your selection trigger.

**Code builder with edge scoring:** Build your accumulator in LUMIÈRE. For each selection, TxLINE's live implied probability is compared against the odds your platform is offering. You see your real market edge per selection and overall — positive edge means you're getting good value, negative means the bookmaker has you.

**Share with context:** Your code goes to Telegram with your edge score attached. Not just "here's my code" — "here's my code and the market says I have +3.2% edge on these selections."

**Live performance tracking:** Every code has a public URL. Selections update in real time as matches play. Your Telegram group watches your code's performance without switching apps.

**Telegram bot (@LumièreBot):** Tag it in any group. It auto-expands shared code links with full details and live status. It posts odds shock alerts during matches. Members can query match odds directly in the group chat.

**Market IQ leaderboard:** Every user builds a verified track record across the tournament — not just "did you win" but "were you right about the market being wrong." The leaderboard shows who actually understands market pricing.

---

## Demo

**[lumiere.vercel.app/watch?demo=true](https://lumiere.vercel.app/watch?demo=true)**

No account, no wallet, no setup. Opens automatically on a historic World Cup match, replays at 5x speed, shows a real odds shock firing, a code being built from it with edge scores, and the Telegram share flow.

---

## TxLINE Integration

| Endpoint | Purpose |
|----------|---------|
| `GET /api/odds/stream` (SSE) | Live odds → shock detection + edge scoring |
| `GET /api/scores/stream` (SSE) | Live match events → code performance tracking |
| `GET /api/fixtures` | Match list for code builder |
| `GET /api/odds/{matchId}/history` | Historical odds for replay engine |
| `GET /api/scores/{matchId}/history` | Historical events for replay engine |

**Auth:** Service Level 12 (real-time, free World Cup tier). Mainnet. Server-side only — credentials never reach the browser.

**Shock detection:** Fires when win probability shifts ≥15% within a 90-second rolling window. Runs server-side in the odds relay route.

**Edge calculation:** `edge = txlineImpliedProbability - platformImpliedProbability`. Positive edge means the market gives a higher probability than your platform's odds imply — you're getting value.

---

## Monetization Path

**Affiliate revenue:** Every "Open in SportyBet/bet9ja" tap carries an affiliate tag. SportyBet, bet9ja, and 1xBet all run affiliate programs — standard CPA per depositing user. This is the primary revenue path and it's immediate.

**Premium tipster tier:** Top 10% Market IQ users can go premium. Followers pay a monthly subscription to receive their codes before public sharing. Platform takes 30%.

**Brand sponsorship:** Betting platforms sponsor the "Shock of the Match" — their logo on the shock alert for high-profile games. The shock alert is the highest-attention moment in the product.

**B2B data:** A dataset of fan selections correlated with market edge and actual outcomes across 104 World Cup games is genuinely valuable to betting operators. Post-tournament data licensing.

---

## Stack

- **Framework:** Next.js 16.2 + TypeScript + Tailwind CSS
- **Data:** TxLINE SSE streams (Service Level 12, mainnet)
- **Auth:** Supabase Auth (Telegram OAuth + Email OTP)
- **Database:** Supabase (codes, selections, shocks, users, leaderboard)
- **AI:** Groq (llama-3.1-8b-instant) for one-sentence shock explanations
- **Bot:** Telegraf.js (@LumièreBot)
- **Deploy:** Vercel (web) + Telegram webhook on Vercel

---

## Run Locally

```bash
git clone https://github.com/TheWeirdDee/lumiere
cd lumiere
npm install
cp .env.example .env.local
# Fill in TxLINE API token, Supabase credentials, Telegram bot token, Groq key
npm run dev -- --webpack
```

Open [http://localhost:3000/watch?demo=true](http://localhost:3000/watch?demo=true)

---

## TxLINE API Feedback

**Loved:** The SSE stream format is clean and reliable. Historical snapshot endpoints made the replay engine straightforward to build. The guest JWT + API token two-credential system is well-documented. Service Level 12 being completely free for World Cup data made the hackathon accessible.

**Friction:** Field names in SSE payloads required trial and error — minor discrepancies between API reference documentation and actual stream output. A versioned stream schema document would save significant debugging time. The on-chain activation flow is correct but has many failure points that surface as silent errors; clearer error messages from the activation endpoint would help.

---

Built by Divine ([@TheWeirdDee](https://github.com/TheWeirdDee)) · Lagos, Nigeria · 2026

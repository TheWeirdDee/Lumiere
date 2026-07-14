# LUMIÈRE — Product Requirements Document

**Track:** Consumer & Fan Experiences  
**Prize:** $10,000 USDT (1st) · $4,000 (2nd) · $2,000 (3rd)  
**Hackathon:** TxODDS World Cup Hackathon on Superteam Earn  
**Deadline:** July 19, 2026 · 23:59 UTC  
**Builder:** Divine ([@TheWeirdDee](https://github.com/TheWeirdDee))  
**Stack:** Next.js 16.2 · TypeScript · Tailwind CSS · Supabase · TxLINE SSE  
**Repo:** `lumiere`  
**Deploy:** Vercel

---

## 1. What LUMIÈRE Is

LUMIÈRE is a real-time odds intelligence companion for fans watching the World Cup. It does one thing better than anything else: it tells you not just what happened in a match, but what the market thinks it means — in real time, in plain English, the moment it matters.

Every time the betting market moves significantly during a match, LUMIÈRE fires an **Odds Shock** alert. A full-screen card appears showing: what moved, how fast, by how much, and a single AI-written sentence explaining what the market is telling you. No jargon. No numbers to decode. Just "France's chance of winning just dropped 18% in under a minute — the red card to Upamecano changed everything."

This is not a scores app. This is not a stats dashboard. This is the market's reaction to live football, made human.

---

## 2. The Problem

Fans watching the World Cup have no way to understand what the betting market is reacting to in real time. Twitter tells them what happened. ESPN tells them the score. But nobody tells them what the market thinks it means — and the market often knows something before commentators catch up.

When a red card happens in the 30th minute, the market moves before the commentator finishes their sentence. That movement is information. Right now it's invisible to 99% of fans.

---

## 3. The Solution

LUMIÈRE watches TxLINE's live odds stream for every World Cup match. When win probability shifts more than 15% within a 90-second window, an Odds Shock fires. The shock is surfaced as a dramatic full-screen alert with:

- Which team's probability changed
- By how much, in how many seconds
- What the market now implies
- One plain-English sentence explaining why (AI-generated, referencing the triggering match event)
- The "before" odds as the counterfactual baseline ("before this, the market thought France had 64% — now it's 22%")

Between shocks, LUMIÈRE shows a live timeline of smaller odds movements as a flowing feed — not alarming, just ambient. The big moments interrupt. The small moments accumulate.

---

## 4. Judging Criteria Alignment

| Criterion | How LUMIÈRE scores |
|-----------|-------------------|
| Fan Accessibility & UX | Zero learning curve. A non-technical fan understands the product in 10 seconds. No wallets, no numbers to decode, no betting knowledge required. |
| Real-Time Responsiveness | Every odds shock fires within seconds of the TxLINE event. The UI updates live during matches. |
| Originality & Value Creation | Nothing like this exists for football. Odds intelligence at fan-accessible level is genuinely new. |
| Commercial & Monetization Path | Clear: subscription model for premium alerts, sponsored by bookmakers, or white-label for broadcasters. |
| Completeness & Execution | Full product: live mode, historical replay, mobile-responsive, demo-ready. |

---

## 5. Users

**Primary:** Football fans watching the World Cup on TV or in a bar, phone in hand. They want to feel the drama of the market reacting to what they're watching. They do not need to understand betting to use LUMIÈRE.

**Secondary:** Casual bettors who want market intelligence without reading odds tables.

**Demo user (judges):** A Superteam judge reviewing after the tournament ends, watching LUMIÈRE's historical replay of a dramatic match, feeling the shocks fire in sequence.

---

## 6. Features

### 6.1 Core: Odds Shock Detector

**Definition:** A shock fires when win probability for either team shifts by more than 15% within a 90-second rolling window, based on TxLINE's live odds stream.

**Shock card contains:**
- Team affected and direction (▼ France 18%)
- Speed of movement ("in 47 seconds")
- Current implied probability ("now 22% to win")
- Counterfactual baseline ("was 40% before the red card")
- AI explanation (one sentence, plain English)
- Triggering match event if detectable from scores stream (goal, red card, penalty)

**Visual treatment:**
- Full-screen takeover on mobile, large modal on desktop
- Red for probability drop, green for probability rise
- Holds for 8 seconds then slides away
- User can tap/click to expand full detail

### 6.2 Live Odds Timeline

Between shocks, a scrolling feed shows smaller odds movements as ambient data. Each entry: team name, delta, timestamp. Movements below 5% are filtered out. This keeps the UI alive during quiet periods without noise.

### 6.3 Match Selector

A horizontal scroll of active/upcoming matches. Each match card shows:
- Teams and current score
- Current win probabilities as a bar
- A pulse indicator if a shock fired in the last 2 minutes

User taps a match to watch it. LUMIÈRE connects to the odds + scores streams for that match immediately.

### 6.4 Historical Replay Mode

**Critical feature.** Since the World Cup ends on submission day, judges need to experience LUMIÈRE on historical data.

Replay mode:
- User selects any completed World Cup match from a list
- Match replays at 5x speed (a 90-minute match plays in 18 minutes) or 15x speed (6 minutes)
- All shocks fire exactly as they did live
- User can seek to any point in the match
- Speed control: 1x / 5x / 15x / instant (all events immediately)

Demo mode (`?demo=true`):
- Pre-selects a specific dramatic match (the one with the most shocks — identify this from historical data)
- Auto-plays at 5x speed
- No user input required — just open the URL and watch

### 6.5 Shock History

A log of every shock that fired for the current match, scrollable. Each entry expandable to show full detail. Shows the arc of a match's drama as a timeline of market reactions.

### 6.6 AI Explanation Engine

For every shock, LUMIÈRE calls an LLM to generate a one-sentence plain-English explanation. The prompt includes: the odds movement data, the triggering event from the scores stream (if any), and instructions to write for a non-technical football fan.

**Model:** Use any free/cheap LLM (Groq's free tier, GPT-4o-mini, DeepSeek). This is not the product — it's one line of text per shock. Cost is negligible.

**Fallback:** If LLM call fails, use a template: "The market reacted sharply to [event], moving [team]'s win probability [direction] by [amount] in [time]."

---

## 7. Design Language

LUMIÈRE's aesthetic: dark, atmospheric, editorial. Like a Bloomberg terminal crossed with a cinema screen. The moment a shock fires should feel like something important just happened.

### 7.1 Colors

```css
--bg:         #080808    /* Near-black base */
--surface:    #0f0f0f    /* Cards and panels */
--border:     #1a1a1a    /* Subtle borders */
--text:        #f0f0f0   /* Primary text */
--muted:      #555555    /* Secondary text */
--shock-red:  #ff2d2d    /* Probability drop */
--shock-green:#00e676    /* Probability rise */
--accent:     #f5c518    /* Highlight — World Cup gold */
--dim:        #2a2a2a    /* Inactive elements */
```

### 7.2 Typography

```
Display/Numbers:  Space Grotesk (Bold) — for probability percentages and deltas
Body:             Inter (Regular/Medium) — for all prose and labels  
Mono:             JetBrains Mono — for timestamps and market data
```

### 7.3 Key UI Moments

**The Shock:** Full-screen (mobile) or large centered modal (desktop). Animates in from bottom with a subtle shake. The probability number is huge — 48px minimum. The direction arrow is the first thing you see. Disappears after 8 seconds with a slide-down unless the user interacts.

**The Timeline:** Subtle, ambient. Left-aligned. Entries slide in from the right. Color-coded by direction. Nothing competes with the shock for attention.

**The Match Card:** Clean. Score prominent. Win probability as a horizontal bar, live-updating. Pulse animation when a shock fired recently.

---

## 8. Technical Architecture

### 8.1 Data Sources

| Source | What it provides | Endpoint |
|--------|-----------------|----------|
| TxLINE Odds SSE | Live odds updates per match | `GET /api/odds/stream` |
| TxLINE Scores SSE | Live match events (goals, cards) | `GET /api/scores/stream` |
| TxLINE Fixtures | Match list, teams, schedule | `GET /api/fixtures` |
| TxLINE Odds History | Historical odds for replay | `GET /api/odds/{matchId}/history` |
| TxLINE Scores History | Historical events for replay | `GET /api/scores/{matchId}/history` |

### 8.2 TxLINE Auth

Two credentials required on every data request:

```
Authorization: Bearer ${jwt}        ← from POST /auth/guest/start
X-Api-Token: ${apiToken}            ← from POST /api/token/activate (after on-chain subscribe)
```

Network: **Mainnet** · Service Level: **12** (real-time, free, no TxL purchase)
Program ID: `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA`

JWT expires and must be renewed on 401. API token is long-lived.

**IMPORTANT:** The activation script runs once before building. The API token goes into `.env`. The JWT is refreshed automatically at runtime.

### 8.3 SSE Architecture

TxLINE's SSE streams are server-side only — they use the `X-Api-Token` header which cannot be exposed in browser code. All stream connections happen in Next.js API routes that relay events to the browser via Server-Sent Events.

```
TxLINE SSE (server-to-server)
    ↓
Next.js API route (server-side)
    ↓
Browser EventSource (client-side)
```

- `src/app/api/odds-relay/route.ts` — relays TxLINE odds stream to browser
- `src/app/api/scores-relay/route.ts` — relays TxLINE scores stream to browser
- `src/app/api/fixtures/route.ts` — proxies TxLINE fixtures endpoint
- `src/app/api/history/[matchId]/route.ts` — proxies historical data + caches in Supabase

### 8.4 Shock Detection

Shock detection runs **server-side** in the odds relay route. Every incoming odds event is checked against a rolling 90-second window of previous odds for that match. If the delta exceeds 15%, a shock event is emitted alongside the normal odds update.

```typescript
// Shock detection logic (server-side, in odds relay)
interface OddsWindow {
  prob: number
  timestamp: number
}

const windows = new Map<string, OddsWindow[]>() // matchId → last 90s of odds

function detectShock(matchId: string, currentProb: number, team: 'home' | 'away'): number | null {
  const key = `${matchId}:${team}`
  const now = Date.now()
  const window = (windows.get(key) || []).filter(w => now - w.timestamp < 90_000)
  
  if (window.length === 0) {
    windows.set(key, [{ prob: currentProb, timestamp: now }])
    return null
  }
  
  const oldest = window[0]
  const delta = Math.abs(currentProb - oldest.prob)
  
  window.push({ prob: currentProb, timestamp: now })
  windows.set(key, window)
  
  return delta >= 0.15 ? currentProb - oldest.prob : null
}
```

### 8.5 Supabase Schema

```sql
-- Odds shocks log
CREATE TABLE lumiere_shocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  affected_team TEXT NOT NULL,      -- 'home' | 'away'
  direction TEXT NOT NULL,          -- 'up' | 'down'
  delta DECIMAL(5, 4) NOT NULL,     -- e.g. 0.18 for 18%
  window_seconds INTEGER NOT NULL,  -- how fast it moved
  pre_prob DECIMAL(5, 4) NOT NULL,  -- probability before shock
  post_prob DECIMAL(5, 4) NOT NULL, -- probability after shock
  trigger_event TEXT,               -- 'goal' | 'red_card' | 'penalty' | null
  trigger_minute INTEGER,
  explanation TEXT,                 -- AI-generated sentence
  fired_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historical match cache (avoid re-fetching TxLINE for replay)
CREATE TABLE lumiere_match_cache (
  match_id TEXT PRIMARY KEY,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  match_date TIMESTAMPTZ NOT NULL,
  odds_history JSONB NOT NULL,
  scores_history JSONB NOT NULL,
  shock_count INTEGER DEFAULT 0,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shocks_match ON lumiere_shocks(match_id);
CREATE INDEX idx_shocks_fired ON lumiere_shocks(fired_at DESC);
```

### 8.6 File Structure

```
lumiere/
├── src/
│   ├── app/
│   │   ├── page.tsx                    ← Landing page
│   │   ├── watch/
│   │   │   └── page.tsx                ← Main watch page (match selector + live feed)
│   │   ├── match/
│   │   │   └── [matchId]/
│   │   │       └── page.tsx            ← Single match view
│   │   ├── replay/
│   │   │   └── [matchId]/
│   │   │       └── page.tsx            ← Historical replay view
│   │   └── api/
│   │       ├── odds-relay/
│   │       │   └── route.ts            ← SSE relay: TxLINE odds → browser
│   │       ├── scores-relay/
│   │       │   └── route.ts            ← SSE relay: TxLINE scores → browser
│   │       ├── fixtures/
│   │       │   └── route.ts            ← Proxy + cache fixtures
│   │       ├── history/
│   │       │   └── [matchId]/
│   │       │       └── route.ts        ← Proxy + cache historical data
│   │       └── explain/
│   │           └── route.ts            ← Generate AI explanation for a shock
│   ├── components/
│   │   ├── ShockAlert.tsx              ← Full-screen shock overlay
│   │   ├── OddsTimeline.tsx            ← Ambient live odds feed
│   │   ├── MatchCard.tsx               ← Match selector card
│   │   ├── MatchList.tsx               ← Horizontal scroll of matches
│   │   ├── ShockHistory.tsx            ← Log of past shocks for current match
│   │   ├── ReplayControls.tsx          ← Speed/seek controls for replay
│   │   └── ProbabilityBar.tsx          ← Live win probability visualization
│   ├── lib/
│   │   ├── txline/
│   │   │   ├── auth.ts                 ← JWT + API token management
│   │   │   ├── stream.ts               ← SSE connection to TxLINE (server-side)
│   │   │   ├── snapshots.ts            ← REST snapshot endpoints
│   │   │   └── types.ts                ← All TxLINE TypeScript types
│   │   ├── shock-detector.ts           ← Shock detection logic
│   │   ├── replay-engine.ts            ← Historical replay engine
│   │   ├── supabase.ts                 ← Supabase client
│   │   └── ai-explain.ts              ← LLM explanation generator
│   └── types/
│       └── index.ts                    ← App-wide TypeScript types
├── scripts/
│   └── activate.ts                     ← One-time TxLINE activation
├── .env.example
├── .env.local                          ← Never commit
├── package.json
├── tsconfig.json
└── next.config.ts
```

---

## 9. Environment Variables

```env
# TxLINE (mainnet, Service Level 12)
TXLINE_API_TOKEN=              # from activation script — long-lived
TXLINE_GUEST_JWT=              # seed value, refreshed at runtime on 401
TXLINE_API_BASE=https://txline.txodds.com/api
TXLINE_API_ORIGIN=https://txline.txodds.com

# Solana (mainnet — for activation script only)
SOLANA_WALLET_PRIVATE_KEY=     # base58 private key — NEVER commit

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# AI explanation (use any cheap/free LLM)
OPENAI_API_KEY=                # or GROQ_API_KEY or DEEPSEEK_API_KEY

# App
NEXT_PUBLIC_APP_URL=https://lumiere.vercel.app
NEXT_PUBLIC_DEMO_MATCH_ID=     # matchId of best historical match for demo
```

---

## 10. Demo Strategy

### The Problem
The World Cup final is July 19th — submission day. Judges review after. Any product requiring a live match fails during judging.

### The Solution: Two-Layer Demo

**Layer 1 — Demo mode (`?demo=true`):**
- Auto-selects the most dramatic completed match (most shocks, identified from historical scan)
- Auto-plays replay at 5x speed
- Judges open one URL and watch without touching anything
- Shocks fire automatically, AI explanations appear
- This is the primary demo experience for judges

**Layer 2 — Live recording clip:**
- Record LUMIÈRE during a live semifinal or final (July 12 or 14)
- Capture a real shock firing live — the most dramatic moment you can find
- Include this 30-second clip in the demo video

### Demo Video Structure (5 minutes max)
1. (0:00–0:30) Open the landing page. One sentence: what LUMIÈRE is.
2. (0:30–1:30) Show the live recording clip — a real shock firing during a real match.
3. (1:30–3:30) Open demo mode. Watch the replay unfold. Shocks fire. Explain each one in voiceover.
4. (3:30–4:30) Show the match selector, the shock history log, the replay controls.
5. (4:30–5:00) Show the app on mobile. It works beautifully on a phone.

### Identifying the Best Demo Match
Before submission, run a script that scans all completed World Cup matches in TxLINE's historical data, counts shocks per match (using the same 15%/90s definition), and picks the match with the most shocks. That match becomes `NEXT_PUBLIC_DEMO_MATCH_ID`.

---

## 11. What Done Looks Like

### Phase 1 Done (TxLINE + infrastructure)
```
[ ] TxLINE subscription activated on mainnet (Service Level 12)
[ ] TXLINE_API_TOKEN and seed TXLINE_GUEST_JWT in .env.local
[ ] GET /api/fixtures returns World Cup matches
[ ] Odds SSE stream connects, emits events, auto-reconnects on drop
[ ] Scores SSE stream connects, emits events, auto-reconnects on drop
[ ] JWT auto-renewal works on 401
[ ] Supabase schema deployed (lumiere_shocks + lumiere_match_cache)
[ ] Historical match data fetchable and cacheable
[ ] npx tsc --noEmit clean
```

### Phase 2 Done (Shock detection + relay)
```
[ ] /api/odds-relay streams normalized odds events to browser via SSE
[ ] /api/scores-relay streams normalized score events to browser via SSE
[ ] Shock detection fires correctly at 15%/90s threshold
[ ] Shocks saved to lumiere_shocks table in Supabase
[ ] /api/explain generates a valid one-sentence AI explanation
[ ] Historical data cached in lumiere_match_cache on first fetch
```

### Phase 3 Done (Replay engine)
```
[ ] Replay engine loads historical match data
[ ] Events re-emitted through same callback interface as live stream
[ ] Speed control works: 1x / 5x / 15x / instant
[ ] Seek works: jump to any timestamp in the match
[ ] Shocks fire at correct relative timestamps during replay
[ ] Demo match identified (most shocks in tournament)
[ ] NEXT_PUBLIC_DEMO_MATCH_ID set in .env
```

### Phase 4 Done (UI components)
```
[ ] ShockAlert: animates in, shows all required data, disappears after 8s
[ ] OddsTimeline: live scrolling feed, color-coded, filtered below 5%
[ ] MatchCard: shows teams, score, probability bar, pulse on recent shock
[ ] MatchList: horizontal scroll, tapping connects to that match
[ ] ShockHistory: scrollable log, expandable entries
[ ] ReplayControls: speed selector, seek bar, play/pause
[ ] ProbabilityBar: live-updating, animated on change
[ ] All components mobile-responsive
[ ] Design tokens applied: colors, fonts, spacing
```

### Phase 5 Done (Pages + integration)
```
[ ] Landing page: explains LUMIÈRE in one screen, links to watch page
[ ] Watch page: match selector + live feed wired end-to-end
[ ] Match page: single match view with all components wired
[ ] Replay page: historical replay with controls wired
[ ] ?demo=true: auto-selects match, auto-plays, no user input required
[ ] Live mode tested during an actual match (semifinal or final)
[ ] Shock fires live, AI explanation generates, saves to Supabase
```

### Phase 6 Done (Polish + deploy)
```
[ ] Deployed to Vercel, live URL working
[ ] ?demo=true works on live URL
[ ] Mobile tested: iPhone Safari, Android Chrome
[ ] Demo video recorded (5 min max, includes live clip + replay demo)
[ ] GitHub repo public with README
[ ] Superteam Earn submission filled in
[ ] Submitted before July 19 23:59 UTC
```

---

## 12. Risk Register

| Risk | Mitigation |
|------|-----------|
| TxLINE SSE drops during live recording | Reconnect logic + record multiple sessions |
| No dramatic shocks during chosen live match | Historical replay guarantees shocks exist |
| AI explanation API slow or fails | Template fallback ("The market moved X% in Y seconds following Z") |
| Demo match has no shocks in historical data | Scan all matches before committing to demo match ID |
| Vercel cold start on SSE relay route | Keep-alive ping every 30s in relay route |
| JWT expiry mid-demo | Auto-renewal on 401 with retry — demo never sees auth error |
| Supabase rate limit | Use service key (no RLS overhead) + batch inserts |

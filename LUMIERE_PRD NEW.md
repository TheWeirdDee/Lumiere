# LUMIÈRE v2 — Product Requirements Document

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

LUMIÈRE is the intelligence layer for football fans who share betting codes.

Every day during the World Cup, millions of fans build accumulators on SportyBet, bet9ja, 1xBet, and 247Bet and share the codes in WhatsApp and Telegram groups. "Here's my 5-game multi, copy this code." The problem: nobody knows if the selections are smart or just lucky. There's no context behind the code. No market intelligence. No track record.

LUMIÈRE changes that. It takes the existing social behaviour — sharing codes — and wraps it in TxLINE's live odds intelligence. Every code you share through LUMIÈRE carries a market edge score. Every shock in the odds stream becomes a moment to build a selection. Every tipster builds a verified track record the market can't lie about.

The odds shock is still the heartbeat of the product. When win probability shifts more than 15% in 90 seconds, LUMIÈRE fires a full-screen alert. But now the shock has a purpose: it's the moment tipsters act. "The market just moved — this is where smart money builds."

---

## 2. The Problem

**What fans currently do:** Build accumulators on betting apps, share the code in Telegram/WhatsApp groups, friends copy it blindly.

**What's broken:**
- No context behind the code — is this selection smart or a guess?
- No track record — is this tipster actually good or just lucky?
- No live performance tracking — is my code winning or losing right now?
- No market intelligence — am I getting good odds or being robbed?
- Sharing is manual and clunky — copy code, switch apps, paste in chat

**What LUMIÈRE fixes:** Every shared code has a market edge score. Every tipster has a verified record. Live performance tracks in real time. The Telegram bot brings it all into your group without switching apps.

---

## 3. Judging Criteria Alignment

| Criterion | How LUMIÈRE scores |
|-----------|-------------------|
| Fan Accessibility & UX | Phone-familiar UX — login with Telegram or email, share codes like you already do on SportyBet. Zero new behaviour required. |
| Real-Time Responsiveness | Odds shocks fire live. Code performance updates as each game plays. Market edge recalculates as odds move. |
| Originality & Value Creation | No product puts TxLINE's live probability data in service of the existing code-sharing behaviour. Tipster reputation backed by market data is genuinely new. |
| Commercial & Monetization Path | Affiliate revenue from betting platforms (clear, immediate), premium tipster subscriptions, brand sponsorship of shock alerts, B2B data. |
| Completeness & Execution | Full end-to-end flow: auth → build code → score it → share it → track it live → Telegram bot → Market IQ leaderboard. |

---

## 4. Users

**Primary:** West African football fans (Nigeria, Kenya, Ghana) who already share betting codes in Telegram groups. They know what an accumulator is. They use SportyBet or bet9ja. They don't need to be educated on how betting works — they need better intelligence.

**Secondary:** Football fans globally who watch with friends and want live market intelligence during matches.

**Telegram group admin:** Adds @LumièreBot to their group. Members start sharing codes with edge scores. The group gets smarter about selections.

**Demo user (judges):** Superteam judge who opens the demo URL, watches an odds shock fire during replay, sees a code being built and scored, shares it to a demo Telegram group, watches live performance update. Understands the full flow in under 5 minutes.

---

## 5. Auth Flow

### 5.1 Primary Auth: Telegram Login

Users who find LUMIÈRE through the Telegram bot (the primary discovery path) log in with one tap via Telegram OAuth. No SMS cost, no email friction, perfectly aligned with the product.

Flow:
1. User clicks "Login with Telegram"
2. Telegram opens, user taps "Confirm"
3. Back in LUMIÈRE — if first time, prompted to choose a username
4. Username is permanent, shown on all shared codes and leaderboard

### 5.2 Fallback Auth: Email + Password

For users who find the web app directly.

Flow:
1. Enter email → receive 6-digit OTP (Supabase email OTP, free)
2. Enter OTP → if first time, choose username and password
3. Return login: email + password (no OTP needed again)

### 5.3 Username Rules
- 3–20 characters, alphanumeric + underscores
- Unique across all users
- Cannot be changed after set
- Shown as @username on shared codes and leaderboard

### 5.4 Supabase Auth Setup
- Telegram OAuth: Supabase supports via custom OAuth provider
- Email OTP: built into Supabase Auth, free tier covers hackathon volume
- User table extended with `username`, `telegram_id`, `market_iq_score`, `created_at`

---

## 6. Core Features

### 6.1 Odds Shock Alerts (Original Core — Unchanged)

When win probability shifts ≥15% within a 90-second rolling window on TxLINE's odds stream, LUMIÈRE fires a full-screen Odds Shock alert:

- Team affected and direction (▼ France 18%)
- Speed of movement ("in 47 seconds")
- Current implied probability ("now 22%")
- Counterfactual baseline ("was 40% before the red card")
- AI explanation (one plain-English sentence)
- **NEW:** Action button — "Add to Code" — pre-fills this selection in the code builder

The shock is still the star. Now it has a purpose beyond watching.

### 6.2 Betting Code Builder

Users build selections manually or via shock alerts. The code builder:

**Inputs:**
- Match (from TxLINE fixtures)
- Selection type: Match Winner / Over-Under Goals / Both Teams to Score / Custom
- Platform: SportyBet / bet9ja / 1xBet / 247Bet / Other
- Odds (user inputs the odds their platform is offering)

**TxLINE intelligence layer:**
For each selection, LUMIÈRE fetches TxLINE's current implied probability for that outcome and shows:
- Market implied probability (from TxLINE odds)
- Your platform's implied probability (calculated from the odds you entered)
- Edge delta: "You're getting +4.2% edge" or "You're paying -8% premium"
- Overall code edge score (average across all selections)

**Code generation:**
- LUMIÈRE generates a shareable code: `LM-{username}-{timestamp}`
- This is LUMIÈRE's own tracking code, not the platform's betting code
- User also inputs their platform's actual betting code (e.g. their SportyBet booking code)
- Both travel together when shared

### 6.3 Code Sharing

**Share to Telegram:**
One tap opens Telegram with a pre-formatted message:

```
🔍 @divine shared a code on LUMIÈRE

Selections: 3 games
Platform: SportyBet
Booking code: XYZ123
Market edge: +4.2% ✅

🇫🇷 France to win (was 40%, now 22% — shock play)
⚽ Over 2.5 goals in ARG vs SUI
🟥 Brazil to win (clean sheet)

Track live: lumiere.app/code/LM-divine-1234
Powered by @LumiereBot
```

**Share link:**
Every code has a public URL: `lumiere.app/code/{code-id}`. Anyone can view performance without logging in.

**Copy to clipboard:**
Platform booking code copies with one tap for pasting into SportyBet etc.

### 6.4 Live Code Performance Tracker

Every shared code has a live performance page that updates as matches play:

- Each selection: ✅ Won / ❌ Lost / 🔴 Live (with current score) / ⏳ Pending
- Running odds (if all selections win so far)
- Final result posted automatically when last match ends
- Edge validation: "Your edge call was correct — France was underpriced"

### 6.5 Telegram Bot (@LumièreBot)

**In a group:**
- Add @LumièreBot to any Telegram group
- When a member shares a LUMIÈRE code link, bot automatically expands it with full details and live status
- When a shock fires for a match the group is watching, bot posts the alert automatically (if configured)
- Members can tag: `@LumièreBot check [match name]` to get current odds and market state

**Direct messages:**
- `/mycode` — shows your active codes and their performance
- `/shock France Spain` — get current odds and recent shocks for a match
- `/leaderboard` — current Market IQ standings

### 6.6 Market IQ Score

Every user builds a Market IQ score across the tournament:

- Calculated from: how often their selections had genuine market edge (positive delta), and what the actual outcome was
- Not just "did you win" — "were you right about the market being wrong"
- Displayed on profile, on all shared codes, and on the tournament leaderboard
- Resets to zero each tournament (season-based)

**Leaderboard:**
- Top 20 Market IQ scores for the World Cup
- Filterable by country
- Updates in real time

### 6.7 Historical Replay Mode

Any completed World Cup match can be replayed at 5x or 15x speed. All odds shocks fire exactly as they did live. Used for:
- Demo mode for judges (`?demo=true`)
- Users reviewing a past match's market movements
- Understanding why a code selection was smart or dumb in hindsight

---

## 7. Product Flow (End to End)

```
User opens LUMIÈRE during France vs Spain
            ↓
Logs in via Telegram (one tap) → sets username @divine
            ↓
Watches live match feed — odds moving, match events
            ↓
Odds shock fires — France drops 18% after red card
Alert: "Market just mispriced France — tipsters are building"
            ↓
Taps "Add to Code" on the shock alert
            ↓
Code builder opens — France to win pre-filled
TxLINE says: market implies 34%, 
             SportyBet offering 2.9x (34.5% implied)
             Edge: +0.5% — marginal but real
            ↓
User adds two more selections manually
Code edge score: +3.2% across 3 selections
            ↓
Taps "Share to Telegram"
Pre-formatted message sent to their group
Code URL: lumiere.app/code/LM-divine-1234
            ↓
Group members see the code + edge score
Some tap the URL to track live performance
            ↓
@LumièreBot in the group auto-expands the link
Shows live status as games play
            ↓
All 3 selections win
Divine's Market IQ score updates: +12 points
Code marked: "Called the market correctly on France"
            ↓
Divine appears on the leaderboard
```

---

## 8. Design Language

Dark, confident, editorial. Feels like a Bloomberg terminal built for football fans who also use Twitter. Not a typical betting app aesthetic — no green gradients, no flashing banners. Clean and credible.

### 8.1 Colors

```css
--bg:           #080808
--surface:      #0f0f0f
--border:       #1a1a1a
--text:         #f0f0f0
--muted:        #555555
--shock-red:    #ff2d2d    /* probability drop */
--shock-green:  #00e676    /* probability rise */
--accent:       #f5c518    /* World Cup gold */
--edge-pos:     #00e676    /* positive edge */
--edge-neg:     #ff2d2d    /* negative edge */
--dim:          #2a2a2a
--telegram:     #229ED9    /* Telegram blue */
```

### 8.2 Typography

```
Display/Numbers:  Space Grotesk Bold — probabilities, percentages, scores
Body:             Inter Regular/Medium — prose, labels, descriptions
Mono:             JetBrains Mono — codes, timestamps, market data
```

### 8.3 Key UI Moments

**The Shock:** Full-screen on mobile. Huge probability number. Direction arrow. "Add to Code" button prominent. 8 seconds then auto-dismiss.

**The Code Card:** Clean, card-based. Edge score is the headline — green pill for positive, red for negative. Platform logo. Booking code with one-tap copy.

**The Leaderboard:** Ranked list with @usernames, Market IQ scores, country flags. Live-updating during active matches.

**The Bot Message:** Formatted clearly in Telegram dark theme. Emojis used sparingly for selection status only.

---

## 9. Technical Architecture

### 9.1 TxLINE Integration

| What | Endpoint | Used for |
|------|----------|---------|
| Live odds | `GET /api/odds/stream` (SSE) | Shock detection, edge scoring |
| Live scores | `GET /api/scores/stream` (SSE) | Match events, code performance |
| Fixtures | `GET /api/fixtures` | Match list for code builder |
| Odds history | `GET /api/odds/{matchId}/history` | Replay engine |
| Scores history | `GET /api/scores/{matchId}/history` | Replay engine |

**Auth:** Service Level 12, mainnet. Guest JWT + API token. Server-side only.

**SSE Architecture:** TxLINE streams → Next.js API relay routes → browser EventSource. Credentials never reach browser.

### 9.2 Shock Detection (server-side)

Fires when win probability shifts ≥15% within 90-second rolling window. Runs in the odds relay API route. Saves to Supabase. Triggers AI explanation generation async.

### 9.3 Edge Calculation

```typescript
function calculateEdge(
  txlineImpliedProb: number,  // from TxLINE odds stream
  platformOdds: number,        // decimal odds user entered
): number {
  const platformImpliedProb = 1 / platformOdds
  return txlineImpliedProb - platformImpliedProb
  // Positive = you have edge, negative = bookmaker has edge
}
```

Edge for a full code = average edge across all selections.

### 9.4 Market IQ Calculation

```typescript
function updateMarketIQ(
  currentScore: number,
  hadEdge: boolean,      // was edge positive at time of selection?
  won: boolean,          // did the selection win?
): number {
  // Correct edge call + win = +15 points
  // Correct edge call + loss = +5 points (edge was real, variance happened)
  // Wrong edge call + win = -5 points (lucky, not smart)
  // Wrong edge call + loss = -10 points
  if (hadEdge && won) return currentScore + 15
  if (hadEdge && !won) return currentScore + 5
  if (!hadEdge && won) return currentScore - 5
  return currentScore - 10
}
```

### 9.5 Supabase Schema

```sql
-- Users (extends Supabase auth.users)
CREATE TABLE lumiere_users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  telegram_id TEXT UNIQUE,
  market_iq INTEGER DEFAULT 0,
  total_codes INTEGER DEFAULT 0,
  winning_codes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Betting codes
CREATE TABLE lumiere_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID REFERENCES lumiere_users(id),
  creator_username TEXT NOT NULL,
  platform TEXT NOT NULL,          -- 'sportybet' | 'bet9ja' | '1xbet' | '247bet' | 'other'
  platform_code TEXT,              -- the actual SportyBet booking code etc
  lumiere_code TEXT UNIQUE NOT NULL, -- LM-{username}-{timestamp}
  selections JSONB NOT NULL,       -- array of selections with edge data
  overall_edge DECIMAL(6,4),       -- average edge across selections
  status TEXT DEFAULT 'pending',   -- 'pending' | 'active' | 'won' | 'lost' | 'partial'
  share_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Individual selections within a code
CREATE TABLE lumiere_selections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id UUID REFERENCES lumiere_codes(id),
  match_id TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  selection_type TEXT NOT NULL,    -- 'home_win' | 'away_win' | 'draw' | 'over_2.5' etc
  platform_odds DECIMAL(8,4),      -- decimal odds from user's platform
  txline_prob DECIMAL(5,4),        -- TxLINE implied probability at time of selection
  platform_prob DECIMAL(5,4),      -- implied prob from platform odds
  edge DECIMAL(6,4),               -- txline_prob - platform_prob
  from_shock BOOLEAN DEFAULT false, -- was this added via a shock alert?
  shock_id UUID,                   -- reference to the shock that triggered it
  status TEXT DEFAULT 'pending',   -- 'pending' | 'won' | 'lost' | 'void'
  match_result TEXT,               -- actual outcome
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Odds shocks
CREATE TABLE lumiere_shocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  affected_team TEXT NOT NULL,
  direction TEXT NOT NULL,
  delta DECIMAL(5,4) NOT NULL,
  window_seconds INTEGER NOT NULL,
  pre_prob DECIMAL(5,4) NOT NULL,
  post_prob DECIMAL(5,4) NOT NULL,
  trigger_event TEXT,
  trigger_minute INTEGER,
  explanation TEXT,
  fired_at TIMESTAMPTZ DEFAULT NOW()
);

-- Match cache for replay
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

-- Leaderboard view
CREATE VIEW lumiere_leaderboard AS
SELECT
  username,
  market_iq,
  total_codes,
  winning_codes,
  ROUND(winning_codes::numeric / NULLIF(total_codes, 0) * 100, 1) as win_rate
FROM lumiere_users
ORDER BY market_iq DESC
LIMIT 100;

-- Indexes
CREATE INDEX idx_codes_creator ON lumiere_codes(creator_id);
CREATE INDEX idx_codes_status ON lumiere_codes(status);
CREATE INDEX idx_codes_lumiere_code ON lumiere_codes(lumiere_code);
CREATE INDEX idx_selections_code ON lumiere_selections(code_id);
CREATE INDEX idx_selections_match ON lumiere_selections(match_id);
CREATE INDEX idx_shocks_match ON lumiere_shocks(match_id);
CREATE INDEX idx_shocks_fired ON lumiere_shocks(fired_at DESC);
```

### 9.6 File Structure

```
lumiere/
├── src/
│   ├── app/
│   │   ├── page.tsx                      ← Landing page
│   │   ├── auth/
│   │   │   └── page.tsx                  ← Login / signup
│   │   ├── watch/
│   │   │   └── page.tsx                  ← Live match feed + shock alerts
│   │   ├── build/
│   │   │   └── page.tsx                  ← Code builder
│   │   ├── code/
│   │   │   └── [codeId]/
│   │   │       └── page.tsx              ← Public code performance page
│   │   ├── profile/
│   │   │   └── page.tsx                  ← User profile + code history
│   │   ├── leaderboard/
│   │   │   └── page.tsx                  ← Market IQ leaderboard
│   │   └── api/
│   │       ├── odds-relay/route.ts       ← TxLINE odds SSE → browser
│   │       ├── scores-relay/route.ts     ← TxLINE scores SSE → browser
│   │       ├── fixtures/route.ts         ← Fixtures proxy + cache
│   │       ├── history/[matchId]/route.ts← Historical data proxy + cache
│   │       ├── explain/route.ts          ← AI explanation generator
│   │       ├── codes/
│   │       │   ├── route.ts              ← POST create code, GET list codes
│   │       │   └── [codeId]/route.ts     ← GET code details, PATCH update status
│   │       ├── edge/route.ts             ← Calculate edge for a selection
│   │       └── telegram-webhook/route.ts ← Telegram bot webhook handler
│   ├── components/
│   │   ├── ShockAlert.tsx                ← Full-screen shock overlay
│   │   ├── OddsTimeline.tsx              ← Ambient live odds feed
│   │   ├── MatchCard.tsx                 ← Match selector card
│   │   ├── CodeBuilder.tsx               ← Selection builder with edge scoring
│   │   ├── CodeCard.tsx                  ← Shareable code display card
│   │   ├── SelectionRow.tsx              ← Individual selection with status
│   │   ├── EdgeBadge.tsx                 ← Edge score pill (green/red)
│   │   ├── MarketIQScore.tsx             ← IQ score display
│   │   ├── Leaderboard.tsx               ← Tournament leaderboard
│   │   ├── ReplayControls.tsx            ← Speed/seek for replay
│   │   └── ProbabilityBar.tsx            ← Live win probability bar
│   ├── lib/
│   │   ├── txline/
│   │   │   ├── auth.ts                   ← JWT + token management
│   │   │   ├── stream.ts                 ← SSE connection (server-side)
│   │   │   ├── snapshots.ts              ← REST endpoints
│   │   │   └── types.ts                  ← TxLINE TypeScript types
│   │   ├── shock-detector.ts             ← Shock detection logic
│   │   ├── edge-calculator.ts            ← Edge scoring logic
│   │   ├── market-iq.ts                  ← Market IQ calculation
│   │   ├── replay-engine.ts              ← Historical replay
│   │   ├── telegram-bot.ts               ← Telegraf bot logic
│   │   ├── supabase.ts                   ← Supabase client + queries
│   │   └── ai-explain.ts                ← LLM explanation generator
│   └── types/
│       └── index.ts                      ← App-wide TypeScript types
├── scripts/
│   ├── activate.ts                       ← One-time TxLINE activation
│   └── find-demo-match.ts                ← Find match with most shocks
├── .env.example
├── .env.local
├── package.json
├── tsconfig.json
└── next.config.ts
```

---

## 10. Environment Variables

```env
# TxLINE
TXLINE_API_TOKEN=
TXLINE_GUEST_JWT=
TXLINE_API_BASE=https://txline.txodds.com/api
TXLINE_API_ORIGIN=https://txline.txodds.com

# Solana (activation script only)
SOLANA_WALLET_PRIVATE_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Telegram bot
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

# AI (Groq free tier)
GROQ_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://lumiere.vercel.app
NEXT_PUBLIC_DEMO_MATCH_ID=
```

---

## 11. Monetization (Describe in Submission, Not Built)

**1. Affiliate revenue:** Every "Open in SportyBet/bet9ja" button carries an affiliate tag. When users click through and place a bet, LUMIÈRE earns a commission. SportyBet, bet9ja, and 1xBet all have affiliate programs. This is the primary revenue stream.

**2. Premium tipster tier:** Tipsters with verified high Market IQ scores (top 10%) can go Premium. Followers pay ₦500/month to receive their codes before they're shared publicly. LUMIÈRE takes 30%.

**3. Brand sponsorship:** Betting platforms sponsor the "Shock of the Match" — their logo on the shock alert for a specific high-profile game. High-value placement because the shock alert is the most-viewed moment.

**4. Tournament leaderboard sponsorship:** The overall Market IQ leaderboard is sponsored by a betting brand. Cash prize for the winner, exposure for the sponsor.

**5. B2B data:** LUMIÈRE builds a dataset of which selections had real market edge correlated with actual outcomes — this is genuinely valuable to betting operators identifying sharp recreational bettors. Sell anonymized signal data after tournament.

---

## 12. Demo Strategy

### Problem
World Cup final is July 19th — submission deadline. Judges review after. Need demo mode.

### Demo Flow (`?demo=true`)
1. Auto-logs in as demo user `@lumiere_demo`
2. Loads best historical match (most shocks) at 5x replay speed
3. Odds shock fires — "Add to Code" button highlighted
4. Auto-builds a 3-selection code from shock
5. Shows edge calculation per selection
6. Shows share flow (Telegram message preview)
7. Shows live performance tracker updating

### Live Recording
Record during France vs Spain (July 14) — the real product on a real live match. Include 30-second clip in demo video showing a real shock firing and a real code being built from it.

### Demo Video (5 minutes)
1. (0:00–0:30) Landing page. "LUMIÈRE puts market intelligence behind every code you share."
2. (0:30–1:00) Live clip — real shock firing during a real match, real code built.
3. (1:00–3:00) Demo mode — replay unfolds, shocks fire, codes built, Telegram share shown.
4. (3:00–3:30) Code performance page — live tracking.
5. (3:30–4:00) Telegram bot — show bot expanding a code in a group.
6. (4:00–4:30) Leaderboard — Market IQ scores.
7. (4:30–5:00) Monetization path — 10 seconds each on affiliate, premium, sponsorship.

---

## 13. What Done Looks Like

### Phase 1 — Infrastructure
```
[ ] TxLINE Service Level 12 activated (mainnet)
[ ] Odds SSE relay streams to browser
[ ] Scores SSE relay streams to browser
[ ] JWT auto-renewal on 401
[ ] Supabase schema deployed (all tables)
[ ] Historical match data fetchable + cached
[ ] npx tsc --noEmit clean
```

### Phase 2 — Auth
```
[ ] Telegram OAuth login works end-to-end
[ ] Email OTP fallback works
[ ] Username selection on first login
[ ] lumiere_users row created on signup
[ ] Auth state persists across sessions
```

### Phase 3 — Shock Detection + Edge
```
[ ] Shocks fire at 15%/90s threshold
[ ] Shocks saved to lumiere_shocks table
[ ] AI explanation generated (Groq)
[ ] Edge calculation correct for a given selection
[ ] Edge displays correctly in code builder
```

### Phase 4 — Code Builder + Sharing
```
[ ] Code builder accepts selections manually
[ ] "Add to Code" from shock alert pre-fills selection
[ ] Edge shown per selection and overall
[ ] Code saved to Supabase with lumiere_code ID
[ ] Telegram share message formatted correctly
[ ] Code public URL works without login
[ ] Platform booking code copy-to-clipboard works
```

### Phase 5 — Live Performance Tracking
```
[ ] Selections update status as match events arrive
[ ] Won/Lost/Live/Pending shown correctly
[ ] Code status resolves when all selections complete
[ ] Market IQ score updates after code resolves
[ ] Leaderboard updates in real time
```

### Phase 6 — Telegram Bot
```
[ ] Bot responds to /start /mycode /shock /leaderboard
[ ] Bot auto-expands lumiere.app/code/* links in groups
[ ] Bot posts shock alerts to configured groups
[ ] Webhook handler processes Telegram updates
[ ] Bot deployed and running
```

### Phase 7 — Replay + Demo
```
[ ] Replay engine works end-to-end
[ ] Demo match identified (most shocks)
[ ] ?demo=true auto-plays without user input
[ ] All shocks fire during demo replay
[ ] Code built from shock in demo mode
[ ] Demo video recorded and uploaded
```

### Phase 8 — Deploy + Submit
```
[ ] Vercel deployment live
[ ] Telegram bot deployed (Railway)
[ ] Mobile tested (real device)
[ ] GitHub repo public with README
[ ] Superteam Earn submission completed
[ ] Submitted before July 19 23:59 UTC
```

---

## ADDITIONS — UX, Animation & Design (Added July 12)

### A1. Two App Modes

**Following Mode** (default, portrait)
For when you're not watching the match — at work, at the pub, on the bus. Full-screen vertical swipe feed, one card per significant event, swiped upward like TikTok. The user never navigates. They swipe through the drama.

Card hierarchy from most to least dramatic:
- **Goal** — explosive Three.js animation, team colour floods the screen
- **Red Card** — sharp red slash animation across the screen
- **Odds Shock** — probability bar bends and snaps, graph line whips
- **Corner Cluster** (3+ corners in 5 minutes) — building pressure card
- **Possession Shift** — ambient filler, keeps feed alive in quiet periods

**Watching Mode** (ambient overlay, for when you ARE watching on TV)
Minimal. Shock alerts appear as a bottom sheet that slides up. Match score and live odds bar always visible. Nothing competes with the TV. Tap the shock to expand. Code builder accessible from expanded view.

Toggle between modes at the top of the watch screen. LUMIÈRE remembers last used mode.

---

### A2. Goal Animation (Three.js)

When a goal fires, LUMIÈRE takes over the screen for 2–3 seconds:

- 3D football flies across the screen on a curved trajectory (or a boot connecting with the ball)
- Particles explode outward in the scoring team's colours
- Card background floods with the team's primary colour
- Subtle screen shake on impact
- Score updates inside the animation — the number flips like a mechanical scoreboard
- Settles into the standard goal card

Every other event has its own distinct animation:
- **Red Card** — sharp red slash cuts diagonally across screen, card slams in behind it
- **Odds Shock** — probability bar visibly bends and snaps to new position
- **Corner Cluster** — gentle pulse radiates from corner of screen

**Implementation rule:** load Three.js lazily, only when a goal event fires. Scene renders for 2–3 seconds then canvas is destroyed. Zero performance cost between goals. Three.js is scoped to the goal moment only — CSS handles everything else.

---

### A3. Copy Rules (Language)

**Keep these words** — already in football fan vocabulary:
odds, market, favourites, accumulator, code, edge, selection, bookmakers

**Never use in user-facing copy:**
implied probability, delta, basis points, win probability percentage, statistical significance

**Plain language replacements:**

| Technical | Fan language |
|-----------|-------------|
| "Win probability shifted 18%" | "Odds jumped fast on France" |
| "Market implied probability" | "Bookmakers think" |
| "Positive edge" | "You're getting good odds here" |
| "Negative edge" | "Bookmakers have the edge on this one" |
| "Delta of 15%" | "The odds moved sharply" |

**AI explanation prompt rule:** LLM prompt must explicitly say: "Never use the words: implied probability, delta, basis points, percentage shift, statistical. Use plain football fan language. One sentence. Maximum 15 words."

---

### A4. Landing Page

Dark background. Huge typography. No nav bar. No feature paragraphs.

**Structure:**
```
[LUMIÈRE wordmark — large, stark]

Feel the World Cup.
The odds. The drama. The codes.

[Animated mock event card — loops every 4 seconds]
Card 1: ⚽ GOAL — Mbappe — France now heavy favourites
Card 2: 🟥 RED CARD — Upamecano — Odds jumped sharply on Morocco
Card 3: 📈 ODDS SHOCK — Market moved fast on Argentina

[CTA]
Watch Live →

[Three feature pills below]
Live odds shocks  ·  Code edge scoring  ·  Telegram bot
```

**CTA copy:** "Watch Live →" — not "Enter" or "Get Started." Feels like walking into a stadium.

**The looping card animation is the product demo.** No screenshots, no feature lists. A non-technical fan sees the card and understands immediately.

**Color theme — World Cup Night:**
```
--bg: #080808
--accent: #f5c518  (World Cup gold)
--text: #f0f0f0
--card-bg: #0f0f0f
```

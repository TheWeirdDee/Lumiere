# LUMIÈRE v2 — Build Phases

**Framework:** Next.js 16.2 · TypeScript · Tailwind CSS  
**Never use Turbopack** — always `--webpack`  
**Repo:** `lumiere`

---

## Pre-Build Checklist

```
[ ] TxLINE activated on mainnet (TXLINE_API_TOKEN in hand)
[ ] Supabase project created (URL + service key + anon key)
[ ] Telegram bot created via @BotFather (TELEGRAM_BOT_TOKEN saved)
[ ] Groq account created at console.groq.com (GROQ_API_KEY saved)
[ ] Node.js 20+ installed
[ ] Git repo created: lumiere
```

---

## Phase 1 — Scaffold + TxLINE + Supabase

### Step 1: Project Scaffold

```bash
npx create-next-app@16.2 lumiere --typescript --tailwind --app --no-eslint
cd lumiere
npm install @supabase/supabase-js eventsource axios tweetnacl @coral-xyz/anchor @solana/web3.js @solana/spl-token telegraf groq-sdk
npm install -D @types/node @types/eventsource tsx bs58 @types/bs58
```

`next.config.ts`:
```typescript
import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  webpack: (config) => config,
}
export default nextConfig
```

Create full folder structure from PRD section 9.6 — every file as empty placeholder export.

**Done when:** `npm run build -- --webpack` passes. `npx tsc --noEmit` passes.

---

### Step 2: TypeScript Types

Build `src/lib/txline/types.ts` and `src/types/index.ts` before any implementation. No `any` types anywhere.

**`src/lib/txline/types.ts`** — all TxLINE data shapes:
```typescript
export type GamePhase = 'NS' | 'H1' | 'HT' | 'H2' | 'F' | 'WET' | 'ET1' | 'HTET' | 'ET2' | 'FET' | 'WPE' | 'PE' | 'FPE' | 'I' | 'A' | 'C' | 'P'
export type EventType = 'goal' | 'red_card' | 'yellow_card' | 'corner' | 'phase_change' | 'substitution' | 'var' | 'penalty'
export type TeamSide = 'home' | 'away'

export interface Fixture {
  matchId: string
  homeTeam: string
  awayTeam: string
  kickoff: number
  status: GamePhase
  homeScore: number
  awayScore: number
  competition: string
}

export interface MatchState {
  matchId: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  phase: GamePhase
  minute: number
  corners: { home: number; away: number }
  yellowCards: { home: number; away: number }
  redCards: { home: number; away: number }
  lastUpdated: number
}

export interface MatchEvent {
  type: EventType
  matchId: string
  timestamp: number
  team: TeamSide
  minute: number
  data: Record<string, unknown>
}

export interface OddsUpdate {
  matchId: string
  timestamp: number
  market: string
  homeProb: number
  awayProb: number
  drawProb: number
  previousHomeProb: number
  previousAwayProb: number
  deltaHome: number
  deltaAway: number
}
```

**`src/types/index.ts`** — all app-wide types:
```typescript
export type SelectionType = 'home_win' | 'away_win' | 'draw' | 'over_2.5' | 'under_2.5' | 'btts_yes' | 'btts_no'
export type Platform = 'sportybet' | 'bet9ja' | '1xbet' | '247bet' | 'other'
export type CodeStatus = 'pending' | 'active' | 'won' | 'lost' | 'partial'
export type SelectionStatus = 'pending' | 'won' | 'lost' | 'void'

export interface OddsShock {
  id?: string
  matchId: string
  homeTeam: string
  awayTeam: string
  affectedTeam: 'home' | 'away'
  direction: 'up' | 'down'
  delta: number
  windowSeconds: number
  preProb: number
  postProb: number
  triggerEvent?: string
  triggerMinute?: number
  explanation?: string
  firedAt: number
}

export interface Selection {
  id?: string
  matchId: string
  homeTeam: string
  awayTeam: string
  selectionType: SelectionType
  platformOdds: number
  txlineProb: number
  platformProb: number
  edge: number
  fromShock: boolean
  shockId?: string
  status: SelectionStatus
  kickoff: number
}

export interface BettingCode {
  id?: string
  creatorId: string
  creatorUsername: string
  platform: Platform
  platformCode?: string
  lumiereCode: string
  selections: Selection[]
  overallEdge: number
  status: CodeStatus
  shareCount: number
  viewCount: number
  createdAt: number
  resolvedAt?: number
}

export interface LumiereUser {
  id: string
  username: string
  telegramId?: string
  marketIQ: number
  totalCodes: number
  winningCodes: number
}

export interface StreamCallbacks {
  onMatchEvent: (event: import('./lib/txline/types').MatchEvent, state: import('./lib/txline/types').MatchState) => void
  onOddsUpdate: (update: import('./lib/txline/types').OddsUpdate) => void
  onShock: (shock: OddsShock) => void
  onError?: (error: Error) => void
}

export interface ReplayControls {
  pause: () => void
  resume: () => void
  seek: (timestamp: number) => void
  stop: () => void
  getCurrentTime: () => number
  getDuration: () => number
  isPlaying: () => boolean
}
```

**Done when:** `npx tsc --noEmit` clean with no `any`.

---

### Step 3: TxLINE Auth

`src/lib/txline/auth.ts` — identical to LUMIERE_BUILD.md v1 Step 3. JWT auto-renewal on 401. Server-side only.

---

### Step 4: TxLINE Activation Script

`scripts/activate.ts` — identical to v1. Run once. Skip if TXLINE_API_TOKEN already exists.

---

### Step 5: Snapshot Endpoints

`src/lib/txline/snapshots.ts` — `getFixtures()`, `getOddsHistory()`, `getScoresHistory()`.

**Before implementing:** Verify exact endpoint paths and field names at `https://txline.txodds.com/api-reference`.

---

### Step 6: Supabase Setup

`src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

// Server-side client (service key — bypasses RLS)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Client-side client (anon key — respects RLS)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

Deploy SQL schema from PRD section 9.5 in Supabase SQL editor.

Verify: insert + select on each table. RLS policies: `lumiere_codes` and `lumiere_selections` readable by all, writable only by creator. `lumiere_users` readable by all, writable only by self.

**Done when:** All tables exist. Test inserts pass. RLS policies active.

---

## Phase 2 — Auth

### Step 7: Supabase Auth Configuration

In Supabase dashboard:
1. Enable Email provider → enable Email OTP (magic link off, OTP on)
2. Enable Telegram OAuth provider:
   - Go to Authentication → Providers → Telegram
   - Enter your Telegram Bot Token
   - Set redirect URL to `${NEXT_PUBLIC_APP_URL}/auth/callback`

### Step 8: Auth Page

`src/app/auth/page.tsx` — two tabs: Telegram and Email.

**Telegram tab:**
```typescript
// Uses Supabase's signInWithOAuth for Telegram
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'telegram',
  options: { redirectTo: `${window.location.origin}/auth/callback` }
})
```

**Email tab:**
- Input: email address
- On submit: `supabase.auth.signInWithOtp({ email })`
- Shows OTP input field
- On OTP submit: `supabase.auth.verifyOtp({ email, token, type: 'email' })`
- On first login: redirect to `/auth/username`

**`src/app/auth/callback/route.ts`** — handles OAuth redirect:
```typescript
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.exchangeCodeForSession(code)
  }
  // Check if user has a username — if not, redirect to /auth/username
  return NextResponse.redirect(new URL('/auth/username', request.url))
}
```

**`src/app/auth/username/page.tsx`** — username selection:
- Input: desired username
- Validate: 3–20 chars, alphanumeric + underscore
- Check uniqueness: query `lumiere_users` table
- On confirm: insert row into `lumiere_users`, redirect to `/watch`

**Done when:**
```
[ ] Telegram OAuth login redirects correctly
[ ] Email OTP sends and verifies
[ ] New user prompted for username
[ ] lumiere_users row created on first login
[ ] Auth state persists (refresh page, still logged in)
[ ] Unauthenticated users redirect to /auth from protected pages
```

---

## Phase 3 — Shock Detection + AI + Edge

### Step 9: Shock Detector

`src/lib/shock-detector.ts` — identical to v1 Step 6. 15% threshold, 90-second window, returns OddsShock or null.

### Step 10: AI Explanation

`src/lib/ai-explain.ts`:
```typescript
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function generateExplanation(shock: {
  affectedTeam: string
  direction: string
  delta: number
  windowSeconds: number
  triggerEvent?: string
  homeTeam: string
  awayTeam: string
}): Promise<string> {
  const teamName = shock.affectedTeam === 'home' ? shock.homeTeam : shock.awayTeam
  const direction = shock.direction === 'down' ? 'dropped' : 'jumped'
  const event = shock.triggerEvent ? ` following a ${shock.triggerEvent.replace('_', ' ')}` : ''
  
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{
        role: 'user',
        content: `You are a football market analyst. Write exactly ONE sentence explaining this odds movement to a casual fan. Do not mention percentages or numbers. Use plain English. Be direct and specific.
        
Match: ${shock.homeTeam} vs ${shock.awayTeam}
Event: ${teamName}'s win probability ${direction} sharply in ${shock.windowSeconds} seconds${event}.

One sentence only:`
      }],
      max_tokens: 80,
      temperature: 0.7,
    })
    return completion.choices[0]?.message?.content?.trim() || generateFallback(shock)
  } catch {
    return generateFallback(shock)
  }
}

function generateFallback(shock: { affectedTeam: string; homeTeam: string; awayTeam: string; direction: string; triggerEvent?: string }): string {
  const team = shock.affectedTeam === 'home' ? shock.homeTeam : shock.awayTeam
  const event = shock.triggerEvent ? ` after the ${shock.triggerEvent.replace('_', ' ')}` : ''
  return `The market moved sharply on ${team}${event} — bettors are reacting fast.`
}
```

### Step 11: Edge Calculator

`src/lib/edge-calculator.ts`:
```typescript
export function calculateEdge(txlineProb: number, platformOdds: number): number {
  // txlineProb: 0-1 (e.g. 0.65 = 65%)
  // platformOdds: decimal (e.g. 2.10)
  const platformProb = 1 / platformOdds
  return Number((txlineProb - platformProb).toFixed(4))
  // Positive = you have market edge
  // Negative = bookmaker has edge over you
}

export function calculateCodeEdge(selections: Array<{ edge: number }>): number {
  if (selections.length === 0) return 0
  const avg = selections.reduce((sum, s) => sum + s.edge, 0) / selections.length
  return Number(avg.toFixed(4))
}

export function formatEdge(edge: number): string {
  const pct = (edge * 100).toFixed(1)
  return edge >= 0 ? `+${pct}%` : `${pct}%`
}

export function edgeLabel(edge: number): 'strong' | 'marginal' | 'negative' {
  if (edge >= 0.05) return 'strong'
  if (edge >= 0) return 'marginal'
  return 'negative'
}
```

### Step 12: Market IQ

`src/lib/market-iq.ts`:
```typescript
export function calculateIQDelta(hadEdge: boolean, won: boolean): number {
  if (hadEdge && won) return 15
  if (hadEdge && !won) return 5
  if (!hadEdge && won) return -5
  return -10
}

export async function updateUserIQ(
  userId: string,
  hadEdge: boolean,
  won: boolean,
  supabaseAdmin: ReturnType<typeof import('@supabase/supabase-js').createClient>
): Promise<void> {
  const delta = calculateIQDelta(hadEdge, won)
  await supabaseAdmin.rpc('increment_market_iq', { user_id: userId, delta })
}
```

Add this SQL function in Supabase:
```sql
CREATE OR REPLACE FUNCTION increment_market_iq(user_id UUID, delta INTEGER)
RETURNS void AS $$
  UPDATE lumiere_users 
  SET market_iq = market_iq + delta
  WHERE id = user_id;
$$ LANGUAGE sql;
```

---

## Phase 4 — API Routes

### Step 13: Odds Relay Route

`src/app/api/odds-relay/route.ts` — same pattern as v1 Step 7. SSE relay from TxLINE to browser. Runs shock detection. Emits `odds` and `shock` events.

```typescript
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Accepts ?matchId=X (optional — filter to one match)
// Emits: event: odds / event: shock / event: reconnecting
// Keep-alive ping every 30s
// JWT renewal on 401 without breaking stream
```

### Step 14: Scores Relay Route

`src/app/api/scores-relay/route.ts` — same pattern. Emits `event` and `state` SSE events.

### Step 15: Supporting Routes

**`/api/fixtures/route.ts`** — proxy + 60s cache.

**`/api/history/[matchId]/route.ts`** — check Supabase cache first, fetch + cache on miss.

**`/api/explain/route.ts`** — POST with shock data, returns `{ explanation: string }`.

**`/api/edge/route.ts`** — POST with `{ matchId, selectionType, platformOdds }`, fetches TxLINE current odds, returns edge calculation.

**`/api/codes/route.ts`**:
- `GET` — list codes for authenticated user
- `POST` — create new code, save to Supabase, return lumiereCode

**`/api/codes/[codeId]/route.ts`**:
- `GET` — return code + selections + live status (public, no auth)
- `PATCH` — update selection status as matches resolve (server-side cron or triggered by scores relay)

---

## Phase 5 — Telegram Bot

### Step 16: Bot Setup

`scripts/setup-telegram.ts` — set webhook:
```typescript
// Run once after deploy to Vercel:
// npx tsx scripts/setup-telegram.ts
// Sets webhook to: ${NEXT_PUBLIC_APP_URL}/api/telegram-webhook

import axios from 'axios'
const token = process.env.TELEGRAM_BOT_TOKEN
const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram-webhook`
await axios.post(`https://api.telegram.org/bot${token}/setWebhook`, { url: webhookUrl, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET })
console.log('Webhook set:', webhookUrl)
```

### Step 17: Bot Logic

`src/lib/telegram-bot.ts`:
```typescript
import { Telegraf } from 'telegraf'

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!)

// /start
bot.start((ctx) => ctx.reply(
  `👋 Welcome to LUMIÈRE\n\nThe market intelligence layer for World Cup codes.\n\n` +
  `Share your codes with edge scores. Track performance live.\n\n` +
  `→ lumiere.vercel.app`
))

// /mycode — show user's active codes
bot.command('mycode', async (ctx) => {
  // Look up user by telegram_id in lumiere_users
  // Fetch their active codes from lumiere_codes
  // Format and reply
})

// /shock [team1] [team2] — get current market state for a match
bot.command('shock', async (ctx) => {
  // Parse match from command args
  // Fetch current odds from TxLINE snapshot
  // Return current probabilities and recent shocks
})

// /leaderboard — top 10 Market IQ
bot.command('leaderboard', async (ctx) => {
  // Query lumiere_leaderboard view
  // Format top 10 with @usernames and scores
})

// Auto-expand lumiere.app/code/* links
bot.on('text', async (ctx) => {
  const text = ctx.message.text
  const codeMatch = text.match(/lumiere\.[a-z]+\/code\/([A-Z0-9-]+)/i)
  if (codeMatch) {
    const codeId = codeMatch[1]
    // Fetch code from Supabase
    // Format and reply with full code details + live status
  }
})
```

### Step 18: Telegram Webhook Route

`src/app/api/telegram-webhook/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { bot } from '@/lib/telegram-bot'

export async function POST(request: NextRequest) {
  // Verify secret token
  const secret = request.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const body = await request.json()
  await bot.handleUpdate(body)
  return NextResponse.json({ ok: true })
}
```

### Step 19: Shock Alert to Groups

When a shock fires in the odds relay, also send to configured Telegram groups:

```typescript
// In odds relay route, after shock detection:
if (shock && shock.delta > 0.20) { // Only big shocks to groups
  const groups = await getConfiguredGroups(shock.matchId) // from Supabase
  for (const chatId of groups) {
    await bot.telegram.sendMessage(chatId, formatShockMessage(shock))
  }
}

function formatShockMessage(shock: OddsShock): string {
  const team = shock.affectedTeam === 'home' ? shock.homeTeam : shock.awayTeam
  const arrow = shock.direction === 'down' ? '📉' : '📈'
  return `${arrow} ODDS SHOCK — ${shock.homeTeam} vs ${shock.awayTeam}\n\n` +
    `${team} win probability ${shock.direction === 'down' ? 'dropped' : 'jumped'} ` +
    `${(shock.delta * 100).toFixed(0)}% in ${shock.windowSeconds}s\n\n` +
    `${shock.explanation || ''}\n\n` +
    `Build a code → lumiere.vercel.app/build`
}
```

**Done when:**
```
[ ] /start /mycode /shock /leaderboard all respond
[ ] Bot auto-expands lumiere code links in groups
[ ] Webhook route verifies secret and processes updates
[ ] Big shocks (>20%) posted to configured groups
[ ] Webhook set on live Vercel URL after deploy
```

---

## Phase 6 — UI Components

Apply design system to `src/app/globals.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Inter:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg: #080808; --surface: #0f0f0f; --border: #1a1a1a;
  --text: #f0f0f0; --muted: #555555; --dim: #2a2a2a;
  --shock-red: #ff2d2d; --shock-green: #00e676; --accent: #f5c518;
  --edge-pos: #00e676; --edge-neg: #ff2d2d; --telegram: #229ED9;
}
body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; }
.font-display { font-family: 'Space Grotesk', sans-serif; }
.font-mono { font-family: 'JetBrains Mono', monospace; }
```

### Step 20: ShockAlert

Full-screen on mobile, centered modal on desktop. Slides up from bottom. 8-second auto-dismiss. "Add to Code" button prominent.

Props: `{ shock: OddsShock, onAddToCode: (shock: OddsShock) => void, onDismiss: () => void }`

Layout:
```
[Arrow + Team name]
[−18% delta — huge, shock-red]  
["in 47 seconds"]
[Explanation sentence]
[Before bar → After bar]
["Add to Code" button — accent color]
["Dismiss" — small, muted]
```

### Step 21: CodeBuilder

`src/components/CodeBuilder.tsx`

State: array of `Selection` objects being built.

**Inputs per selection:**
- Match picker (from fixtures, dropdown or search)
- Selection type (Winner / Over-Under / BTTS)
- Platform (SportyBet / bet9ja / 1xBet / 247Bet / Other)
- Platform odds (decimal number input)

**Auto-filled from shock (when triggered via "Add to Code"):**
- matchId, homeTeam, awayTeam pre-filled
- selectionType inferred from shock (affectedTeam to win)

**After odds input:**
- Calls `/api/edge` to get TxLINE probability
- Shows edge calculation inline
- EdgeBadge updates in real time

**Footer:**
- Overall code edge (average)
- Platform booking code input (optional)
- "Share to Telegram" button
- "Copy Link" button

### Step 22: EdgeBadge

`src/components/EdgeBadge.tsx`

Small pill: green for positive edge, red for negative.
```
+4.2% edge  ← green
-2.1% edge  ← red
Marginal    ← yellow for 0–2%
```

### Step 23: CodeCard

`src/components/CodeCard.tsx`

Shareable code display. Shows on code performance page and in share preview.

```
[LM-divine-1234]           [Platform logo]
[3 selections · +3.2% edge]
[Status: Active 🔴 Live]

France to win     ✅ Won
Over 2.5 goals    🔴 Live 1-1 (65')
Brazil clean sheet ⏳ Pending

[Copy SportyBet code: XYZ123]
[View live: lumiere.app/code/...]
```

### Step 24: MarketIQScore + Leaderboard

`src/components/MarketIQScore.tsx` — displays score with a label (Rookie / Sharp / Expert / Elite).

`src/components/Leaderboard.tsx` — top 20 ranked by IQ. Live-updating. Shows @username, score, win rate, flag emoji for country (optional).

### Step 25: OddsTimeline + ProbabilityBar + ReplayControls

Same as v1 — OddsTimeline shows ambient odds movements. ProbabilityBar shows live win probabilities. ReplayControls has speed selector and seek bar.

---

## Phase 7 — Pages

### Step 26: Landing Page

`src/app/page.tsx`

Hero: "LUMIÈRE — The market intelligence layer for World Cup codes."

Subheadline: "Build smarter accumulators. Share with edge scores. Track performance live."

Three feature highlights:
1. Odds shock alerts — "Know when the market moves before your commentator does"
2. Code builder with edge scoring — "See if your selections have real market edge"
3. Share to Telegram — "Your code + your edge score, in your group, in one tap"

CTA: "Get Started" → /auth · "See Demo" → /watch?demo=true

### Step 27: Watch Page

`src/app/watch/page.tsx`

Main product experience. 

Layout:
- Top: active matches (MatchCard row)
- Middle: ProbabilityBar for selected match
- Feed: OddsTimeline
- Overlay: ShockAlert queue
- FAB: "Build Code" button (floating action button)

Demo mode (`?demo=true`):
- Auto-selects demo match
- Replays at 5x speed
- ShockAlert fires automatically
- "Add to Code" triggers CodeBuilder with pre-filled selection

### Step 28: Build Page

`src/app/build/page.tsx`

CodeBuilder component full-page. Requires auth. Pre-fills from URL params when coming from shock alert.

### Step 29: Code Performance Page

`src/app/code/[codeId]/page.tsx`

Public — no auth required. Shows CodeCard with live status. Refreshes every 30 seconds via polling. Shows creator @username and Market IQ.

### Step 30: Profile + Leaderboard Pages

`src/app/profile/page.tsx` — user's codes, Market IQ score, history.

`src/app/leaderboard/page.tsx` — tournament leaderboard.

---

## Phase 8 — Replay Engine + Demo Mode

### Step 31: Replay Engine

`src/lib/replay-engine.ts` — identical to v1. Loads historical data, re-emits through same StreamCallbacks interface, speed control, seek.

### Step 32: Replay API Route

`src/app/api/replay/route.ts` — accepts `?matchId=X&speed=N`, streams historical events as SSE in same format as live relays.

### Step 33: Find Demo Match

`scripts/find-demo-match.ts` — scan all completed matches, count shocks per match using same 15%/90s definition, print top 5. Best match → `NEXT_PUBLIC_DEMO_MATCH_ID`.

### Step 34: Demo Mode Wiring

In watch page: `?demo=true` →
1. Skip auth check
2. Auto-load demo match
3. Auto-start replay at 5x
4. Auto-trigger ShockAlert when first shock fires
5. Auto-open CodeBuilder when "Add to Code" shown
6. Show Telegram share preview (no actual send in demo)

---

## Phase 9 — Deploy + Record + Submit

### Step 35: Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

Set all env vars in Vercel dashboard. Verify `?demo=true` works on live URL.

### Step 36: Set Telegram Webhook

After Vercel deploy:
```bash
npx tsx scripts/setup-telegram.ts
```

Test bot commands in a real Telegram group.

### Step 37: Live Recording

During France vs Spain (July 14) or any semifinal:
- Open LUMIÈRE on live match
- Wait for a real odds shock
- Record 30 seconds: shock fires → Add to Code → code built with edge → share preview

### Step 38: Demo Video (5 min max)

1. (0:00–0:30) Landing page. One sentence.
2. (0:30–1:00) Live clip from the match recording.
3. (1:00–2:30) Demo mode — replay, shock fires, code built from shock, edge shown.
4. (2:30–3:30) Share to Telegram — show formatted message. Show bot in group.
5. (3:30–4:00) Code performance page — live tracking.
6. (4:00–4:30) Leaderboard — Market IQ scores.
7. (4:30–5:00) Monetization path — affiliate, premium tipster, sponsorship.

### Step 39: Submission

GitHub repo public with README. Superteam Earn form filled. Submitted before July 19 23:59 UTC.

---

## Agent Prompt (paste to Antigravity / Claude Code)

---

You are building **LUMIÈRE** — a real-time odds intelligence and betting code sharing platform for World Cup fans. Read `LUMIERE_PRD.md` and this build file fully before writing any code.

**Framework:** Next.js 16.2. TypeScript. Tailwind CSS. Never use Turbopack. Always `--webpack`.

**What LUMIÈRE does:** Fans build betting accumulators (codes for SportyBet, bet9ja, 1xBet etc), share them with market edge scores powered by TxLINE's live odds data, track performance live, and interact via a Telegram bot. Odds shocks are the heartbeat — when the market moves 15%+ in 90 seconds, an alert fires and becomes the trigger for building a code selection.

**Critical rules:**
1. No `any` types. Ever. All types in `src/lib/txline/types.ts` and `src/types/index.ts`.
2. TxLINE credentials never reach the browser. All TxLINE connections in API routes only.
3. SSE relay routes must handle JWT renewal on 401 without breaking the stream.
4. Replay engine callbacks must be identical to live stream callbacks.
5. Shock detection is server-side only, in the odds relay route.
6. `npx tsc --noEmit` after every phase. Fix all errors before proceeding.
7. Before implementing any TxLINE API call, verify exact field names at `https://txline.txodds.com/api-reference`.
8. `?demo=true` must work without any user input — auto-plays, shocks fire, code built automatically.

**TxLINE auth:** Two headers on every server-side data request:
- `Authorization: Bearer ${jwt}` — expires, auto-renewed on 401
- `X-Api-Token: ${apiToken}` — from env, long-lived, never refresh

**Build in phase order:** Phase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Confirm done criteria for each phase before starting the next.

Start with Phase 1 Step 1: scaffold. Confirm when `npm run build -- --webpack` and `npx tsc --noEmit` both pass on empty placeholders.

---

## ADDITIONS — Steps to implement UX/Design additions

### Step A1: Two Mode Architecture

In `RadarDashboard.tsx` (or `watch/page.tsx`), add mode state:

```typescript
type AppMode = 'following' | 'watching'
const [mode, setMode] = useState<AppMode>('following')
```

**Following mode renders:** `SwipeFeed` component — full-screen vertical scroll snap container. Each card is 100vh. Scroll snap mandatory. Cards slide up on swipe.

**Watching mode renders:** `AmbientOverlay` component — static match view with score and probability bar always visible. Shock alerts as bottom sheet (`translate-y` transition from off-screen).

Mode toggle: two pill buttons at top of screen. Persist to `localStorage`.

---

### Step A2: SwipeFeed Component

`src/components/SwipeFeed.tsx`

```typescript
// Full-screen vertical swipe feed
// Each card is 100dvh, scroll-snap-align: start
// Receives: events array (goals, shocks, red cards, corners, possession)
// Renders each as a full-screen card with appropriate animation
// Shows empty state when no events yet: "Waiting for the match to start..."
```

CSS:
```css
.swipe-feed {
  height: 100dvh;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
}
.swipe-card {
  height: 100dvh;
  scroll-snap-align: start;
}
```

Card types to render:
- `GoalCard` — triggers Three.js animation on mount
- `RedCardCard` — red slash animation
- `ShockCard` — existing ShockAlert adapted to full-screen
- `CornerClusterCard` — pulsing corner animation
- `PossessionCard` — ambient, minimal

---

### Step A3: Three.js Goal Animation

`src/components/GoalAnimation.tsx`

```typescript
// Lazy-loaded Three.js component
// Only imported and rendered when a goal event fires
// Renders for exactly 2500ms then calls onComplete() callback
// Scene: football on curved trajectory OR boot connecting with ball
// Particles: team colour (pass as prop)
// Screen shake: CSS class with keyframe animation added to body for 300ms
// Score flip: CSS perspective transform on the score number

// Implementation:
// 1. Dynamic import Three.js only on goal event
// 2. Create canvas overlay (position: fixed, z-index: 9999)
// 3. Render scene for 2500ms
// 4. Clean up canvas and Three.js scene completely
// 5. Call onComplete() to show the goal card underneath
```

Team colours (add to constants):
```typescript
export const TEAM_COLOURS: Record<string, string> = {
  // Will be populated from TxLINE fixture data
  // Fallback: home team = #f5c518 (gold), away team = #229ED9 (blue)
  default_home: '#f5c518',
  default_away: '#229ED9',
}
```

---

### Step A4: Landing Page

`src/app/page.tsx` — full rewrite to match spec.

Key implementation notes:

**Looping card animation:**
```typescript
const DEMO_CARDS = [
  { type: 'goal', team: 'France', player: 'Mbappe', text: 'France now heavy favourites' },
  { type: 'red_card', team: 'Morocco', player: 'Upamecano', text: 'Odds jumped sharply on Morocco' },
  { type: 'shock', team: 'Argentina', text: 'Market moved fast on Argentina' },
]

// Cycle through cards every 4000ms
// CSS: card slides up with translateY transition, opacity fade
// Each card type has its background colour: goal=team gold, red_card=red, shock=surface
```

**No Three.js on landing** — the landing card animation is CSS only. Three.js only loads on actual goal events inside the app.

**Font sizes:**
```css
.wordmark { font-size: clamp(3rem, 10vw, 7rem); }
.tagline { font-size: clamp(1.2rem, 3vw, 2rem); }
```

---

### Step A5: AI Explanation Prompt Update

In `src/lib/ai-explain.ts`, update the system prompt:

```typescript
const systemPrompt = `You are a football commentator writing for fans watching the World Cup.

Write exactly ONE sentence explaining this odds movement.
Maximum 15 words.
Use plain football fan language.

NEVER use these words: implied probability, delta, basis points, percentage shift, statistical, variance, deviation.

ALWAYS use words like: odds, market, bookmakers, favourites, chances, likely, unlikely.

Examples of good output:
- "Bookmakers now think France will win after that red card."
- "The odds moved fast — Argentina are suddenly favourites."
- "Market reacted instantly to the goal, Morocco now huge underdogs."

One sentence only. No numbers. No percentages.`
```

---

### Step A6: Copy Audit

Before final deploy, search the entire codebase for these strings and replace:
- "implied probability" → remove from UI, keep in comments only
- "delta" → replace with "movement" or "shift" in UI text
- "win probability" → replace with "chances" or "odds"
- "percentage" → replace with the actual English description

This is a final pass before demo recording, not a build-time task.

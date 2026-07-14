# LUMIÈRE — Build Phases

**Total time:** Days 5–6 of the hackathon (after txline-core infrastructure is done)  
**Framework:** Next.js 16.2 · TypeScript · Tailwind CSS  
**No Turbopack** — use `--webpack` flag on all dev/build commands  
**Repo:** `lumiere` (separate from txline-core)

---

## Pre-Build Requirements

Before starting Phase 1, confirm these are ready:

```
[ ] TxLINE activated on mainnet (TXLINE_API_TOKEN in hand)
[ ] Supabase project exists (URL + service key)
[ ] Solana wallet has mainnet SOL (for activation — already done if txline-core is done)
[ ] Node.js 20+ installed
[ ] Git repo created: lumiere
```

---

## Phase 1 — Scaffold + TxLINE Integration

**Goal:** Next.js app running, TxLINE connected, streams verified working.

### Step 1: Project Scaffold

```bash
npx create-next-app@16.2 lumiere --typescript --tailwind --app --no-eslint
cd lumiere
```

**Install dependencies:**
```bash
npm install @supabase/supabase-js eventsource axios tweetnacl @coral-xyz/anchor @solana/web3.js @solana/spl-token
npm install -D @types/node @types/eventsource tsx
```

**Configure next.config.ts:**
```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {},
  webpack: (config) => config, // explicit webpack, no turbopack
}

export default nextConfig
```

**Create folder structure:**
```
src/
├── app/
│   ├── page.tsx                    (placeholder)
│   ├── watch/page.tsx              (placeholder)
│   ├── match/[matchId]/page.tsx    (placeholder)
│   ├── replay/[matchId]/page.tsx   (placeholder)
│   └── api/
│       ├── odds-relay/route.ts     (placeholder)
│       ├── scores-relay/route.ts   (placeholder)
│       ├── fixtures/route.ts       (placeholder)
│       ├── history/[matchId]/route.ts (placeholder)
│       └── explain/route.ts        (placeholder)
├── components/                     (empty)
├── lib/
│   ├── txline/
│   │   ├── auth.ts                 (placeholder)
│   │   ├── stream.ts               (placeholder)
│   │   ├── snapshots.ts            (placeholder)
│   │   └── types.ts                (placeholder)
│   ├── shock-detector.ts           (placeholder)
│   ├── replay-engine.ts            (placeholder)
│   ├── supabase.ts                 (placeholder)
│   └── ai-explain.ts              (placeholder)
└── types/index.ts                  (placeholder)
```

**Done when:** `npm run build -- --webpack` succeeds on empty placeholders.

---

### Step 2: TypeScript Types

Build `src/lib/txline/types.ts` and `src/types/index.ts` before any implementation.

**`src/lib/txline/types.ts`:**
```typescript
export type GamePhase = 'NS' | 'H1' | 'HT' | 'H2' | 'F' | 'WET' | 'ET1' | 'HTET' | 'ET2' | 'FET' | 'WPE' | 'PE' | 'FPE' | 'I' | 'A' | 'C' | 'P'
export type EventType = 'goal' | 'red_card' | 'yellow_card' | 'corner' | 'phase_change' | 'substitution' | 'var' | 'var_end' | 'penalty'
export type TeamSide = 'home' | 'away'

export interface Fixture {
  matchId: string
  homeTeam: string
  awayTeam: string
  kickoff: number // unix timestamp
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

export interface TxLineCredentials {
  jwt: string
  apiToken: string
}
```

**`src/types/index.ts`:**
```typescript
export interface OddsShock {
  id?: string
  matchId: string
  homeTeam: string
  awayTeam: string
  affectedTeam: 'home' | 'away'
  direction: 'up' | 'down'
  delta: number           // e.g. 0.18 = 18%
  windowSeconds: number   // how fast it moved
  preProb: number         // probability before shock
  postProb: number        // probability after shock
  triggerEvent?: string   // 'goal' | 'red_card' | 'penalty' | null
  triggerMinute?: number
  explanation?: string    // AI-generated
  firedAt: number         // unix timestamp
}

export interface ReplayOptions {
  matchId: string
  speed: number           // 1 = realtime, 5 = 5x, 15 = 15x, 0 = instant
  startAt?: number        // unix timestamp
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

export interface StreamCallbacks {
  onMatchEvent: (event: import('./lib/txline/types').MatchEvent, state: import('./lib/txline/types').MatchState) => void
  onOddsUpdate: (update: import('./lib/txline/types').OddsUpdate) => void
  onShock: (shock: OddsShock) => void
  onError?: (error: Error) => void
}
```

**Done when:** `npx tsc --noEmit` clean with no `any` types.

---

### Step 3: TxLINE Auth

Build `src/lib/txline/auth.ts`.

```typescript
// This module manages TxLINE credentials.
// Guest JWT expires — auto-renewed on 401.
// API token is long-lived — read from env, never refreshed.

const API_ORIGIN = process.env.TXLINE_API_ORIGIN!

let currentJwt: string = process.env.TXLINE_GUEST_JWT || ''

export async function refreshJWT(): Promise<string> {
  const response = await fetch(`${API_ORIGIN}/auth/guest/start`, {
    method: 'POST',
  })
  if (!response.ok) throw new Error(`JWT refresh failed: ${response.status}`)
  const data = await response.json()
  currentJwt = data.token
  return currentJwt
}

export async function getCredentials(): Promise<{ jwt: string; apiToken: string }> {
  if (!currentJwt) await refreshJWT()
  return {
    jwt: currentJwt,
    apiToken: process.env.TXLINE_API_TOKEN!,
  }
}

export async function getHeaders(): Promise<Record<string, string>> {
  const { jwt, apiToken } = await getCredentials()
  return {
    Authorization: `Bearer ${jwt}`,
    'X-Api-Token': apiToken,
  }
}

// Call this when a 401 is received — refreshes JWT and returns new headers
export async function handleUnauthorized(): Promise<Record<string, string>> {
  await refreshJWT()
  return getHeaders()
}
```

**Done when:**
```
[ ] POST /auth/guest/start succeeds
[ ] getHeaders() returns correct Authorization + X-Api-Token
[ ] Simulated 401 triggers refreshJWT() and retry
```

---

### Step 4: Activation Script (run once)

Build `scripts/activate.ts`. This runs once to create the on-chain subscription and get the API token. Skip if TXLINE_API_TOKEN already exists in .env from txline-core work.

```typescript
// scripts/activate.ts
// Run: npx tsx scripts/activate.ts
// Requires: SOLANA_WALLET_PRIVATE_KEY in .env
// Output: prints TXLINE_API_TOKEN — add to .env.local manually

import * as anchor from '@coral-xyz/anchor'
import { Connection, PublicKey, SystemProgram, Keypair } from '@solana/web3.js'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token'
import axios from 'axios'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const API_ORIGIN = 'https://txline.txodds.com'
const API_BASE = `${API_ORIGIN}/api`
const RPC_URL = 'https://api.mainnet-beta.solana.com'
const PROGRAM_ID = new PublicKey('9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA')
const TXL_MINT = new PublicKey('Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL')
const SERVICE_LEVEL = 12
const DURATION_WEEKS = 4
const SELECTED_LEAGUES: number[] = []

async function activate() {
  // Load wallet from env
  const privateKeyBase58 = process.env.SOLANA_WALLET_PRIVATE_KEY!
  const keypair = Keypair.fromSecretKey(bs58.decode(privateKeyBase58))
  
  const connection = new Connection(RPC_URL, 'confirmed')
  const wallet = new anchor.Wallet(keypair)
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' })
  anchor.setProvider(provider)

  // Load IDL — download from TxLINE docs or use their npm package
  // const program = new anchor.Program(idl, provider)
  
  // Get guest JWT
  const authRes = await axios.post(`${API_ORIGIN}/auth/guest/start`)
  const jwt = authRes.data.token
  console.log('Guest JWT obtained')

  // Derive PDAs
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([Buffer.from('token_treasury_v2')], PROGRAM_ID)
  const tokenTreasuryVault = getAssociatedTokenAddressSync(TXL_MINT, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync([Buffer.from('pricing_matrix')], PROGRAM_ID)
  const userTokenAccount = getAssociatedTokenAddressSync(TXL_MINT, keypair.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)

  // Subscribe on-chain
  // const txSig = await program.methods.subscribe(SERVICE_LEVEL, DURATION_WEEKS).accounts({...}).rpc()
  // console.log('Subscribed:', txSig)

  // Sign activation message
  // const messageString = `${txSig}:${SELECTED_LEAGUES.join(',')}:${jwt}`
  // const message = new TextEncoder().encode(messageString)
  // const signatureBytes = nacl.sign.detached(message, keypair.secretKey)
  // const walletSignature = Buffer.from(signatureBytes).toString('base64')

  // Activate
  // const activationRes = await axios.post(`${API_BASE}/token/activate`, { txSig, walletSignature, leagues: SELECTED_LEAGUES }, { headers: { Authorization: `Bearer ${jwt}` } })
  // console.log('API Token:', activationRes.data.token)
  // console.log('\nAdd to .env.local:\nTXLINE_API_TOKEN=' + activationRes.data.token)
  // console.log('TXLINE_GUEST_JWT=' + jwt)
}

activate().catch(console.error)
```

**NOTE:** The actual IDL file must be downloaded from TxLINE's documentation or their npm package. Check `https://txline-docs.txodds.com/llms.txt` for the IDL download location. The script above shows the structure — complete it with the actual IDL import once found.

**Done when:** TXLINE_API_TOKEN is in .env.local and `GET /api/fixtures` returns World Cup data.

---

### Step 5: Snapshot Endpoints

Build `src/lib/txline/snapshots.ts`.

```typescript
import { getHeaders, handleUnauthorized } from './auth'
import type { Fixture, OddsUpdate, MatchEvent } from './types'

const API_BASE = process.env.TXLINE_API_BASE!

async function fetchWithAuth(url: string): Promise<unknown> {
  let headers = await getHeaders()
  let response = await fetch(url, { headers })
  
  if (response.status === 401) {
    headers = await handleUnauthorized()
    response = await fetch(url, { headers })
  }
  
  if (!response.ok) throw new Error(`TxLINE ${response.status}: ${url}`)
  return response.json()
}

export async function getFixtures(): Promise<Fixture[]> {
  const data = await fetchWithAuth(`${API_BASE}/fixtures`) as { fixtures: Fixture[] }
  return data.fixtures || []
}

export async function getOddsHistory(matchId: string): Promise<OddsUpdate[]> {
  const data = await fetchWithAuth(`${API_BASE}/odds/${matchId}/history`) as { updates: OddsUpdate[] }
  return data.updates || []
}

export async function getScoresHistory(matchId: string): Promise<MatchEvent[]> {
  const data = await fetchWithAuth(`${API_BASE}/scores/${matchId}/history`) as { events: MatchEvent[] }
  return data.events || []
}
```

**NOTE:** The exact TxLINE endpoint paths must be verified against their API reference at `https://txline.txodds.com/api-reference`. The paths above follow the pattern documented in their quickstart — confirm the exact paths before using.

**Done when:**
```
[ ] getFixtures() returns at least one World Cup match
[ ] getOddsHistory() returns array for a completed match
[ ] getScoresHistory() returns events for a completed match
[ ] All return types match types.ts
[ ] tsc --noEmit clean
```

---

## Phase 2 — Shock Detection + API Routes

**Goal:** Shocks detected server-side, streamed to browser, AI explanations generated.

### Step 6: Shock Detector

Build `src/lib/shock-detector.ts`.

```typescript
import type { OddsUpdate } from './txline/types'
import type { OddsShock } from '../types'

const SHOCK_THRESHOLD = 0.15   // 15% probability shift
const SHOCK_WINDOW_MS = 90_000 // 90 second rolling window

interface OddsPoint {
  prob: number
  timestamp: number
}

// Separate windows per match per team
const homeWindows = new Map<string, OddsPoint[]>()
const awayWindows = new Map<string, OddsPoint[]>()

function checkWindow(
  windows: Map<string, OddsPoint[]>,
  matchId: string,
  currentProb: number,
  now: number
): { delta: number; windowSeconds: number; preProb: number } | null {
  const key = matchId
  const current = windows.get(key) || []
  const filtered = current.filter(p => now - p.timestamp < SHOCK_WINDOW_MS)
  
  filtered.push({ prob: currentProb, timestamp: now })
  windows.set(key, filtered)
  
  if (filtered.length < 2) return null
  
  const oldest = filtered[0]
  const delta = currentProb - oldest.prob
  
  if (Math.abs(delta) < SHOCK_THRESHOLD) return null
  
  return {
    delta,
    windowSeconds: Math.round((now - oldest.timestamp) / 1000),
    preProb: oldest.prob,
  }
}

export function detectShock(
  update: OddsUpdate,
  matchState: { homeTeam: string; awayTeam: string }
): OddsShock | null {
  const now = Date.now()
  
  // Check home team
  const homeResult = checkWindow(homeWindows, update.matchId, update.homeProb, now)
  if (homeResult) {
    return {
      matchId: update.matchId,
      homeTeam: matchState.homeTeam,
      awayTeam: matchState.awayTeam,
      affectedTeam: 'home',
      direction: homeResult.delta > 0 ? 'up' : 'down',
      delta: Math.abs(homeResult.delta),
      windowSeconds: homeResult.windowSeconds,
      preProb: homeResult.preProb,
      postProb: update.homeProb,
      firedAt: now,
    }
  }
  
  // Check away team
  const awayResult = checkWindow(awayWindows, update.matchId, update.awayProb, now)
  if (awayResult) {
    return {
      matchId: update.matchId,
      homeTeam: matchState.homeTeam,
      awayTeam: matchState.awayTeam,
      affectedTeam: 'away',
      direction: awayResult.delta > 0 ? 'up' : 'down',
      delta: Math.abs(awayResult.delta),
      windowSeconds: awayResult.windowSeconds,
      preProb: awayResult.preProb,
      postProb: update.awayProb,
      firedAt: now,
    }
  }
  
  return null
}

export function resetDetector(matchId: string) {
  homeWindows.delete(matchId)
  awayWindows.delete(matchId)
}
```

**Done when:** Unit test — feed 5 odds updates with a 20% drop over 45 seconds, verify shock fires. Feed 5 updates with 5% drop, verify no shock.

---

### Step 7: Odds Relay API Route

Build `src/app/api/odds-relay/route.ts`.

This is the most important route. It:
1. Connects to TxLINE's odds SSE stream server-side
2. Runs shock detection on each update
3. Relays both odds updates AND shocks to the browser via SSE
4. Handles JWT renewal and reconnection

```typescript
import { NextRequest } from 'next/server'
import { getHeaders, handleUnauthorized } from '@/lib/txline/auth'
import { detectShock } from '@/lib/shock-detector'
import { saveShock } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const matchId = request.nextUrl.searchParams.get('matchId')
  
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      
      // Keep-alive ping every 30s
      const pingInterval = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`))
      }, 30_000)
      
      let headers = await getHeaders()
      const txlineUrl = `${process.env.TXLINE_API_BASE}/odds/stream${matchId ? `?matchId=${matchId}` : ''}`
      
      // Match state for shock detection context
      const matchStates = new Map<string, { homeTeam: string; awayTeam: string }>()
      
      async function connect() {
        try {
          const response = await fetch(txlineUrl, { headers })
          
          if (response.status === 401) {
            headers = await handleUnauthorized()
            return connect()
          }
          
          if (!response.ok || !response.body) {
            send('error', { message: `TxLINE odds stream error: ${response.status}` })
            return
          }
          
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            
            for (const line of lines) {
              if (line.startsWith('data:')) {
                try {
                  const rawData = JSON.parse(line.slice(5).trim())
                  
                  // Normalize to OddsUpdate shape
                  // NOTE: Adjust field names to match actual TxLINE odds SSE payload
                  const update = normalizeOddsUpdate(rawData)
                  
                  // Update match state if we have team info
                  if (rawData.homeTeam && rawData.awayTeam) {
                    matchStates.set(update.matchId, {
                      homeTeam: rawData.homeTeam,
                      awayTeam: rawData.awayTeam,
                    })
                  }
                  
                  // Send odds update
                  send('odds', update)
                  
                  // Check for shock
                  const state = matchStates.get(update.matchId)
                  if (state) {
                    const shock = detectShock(update, state)
                    if (shock) {
                      send('shock', shock)
                      // Save to Supabase async — don't block the stream
                      saveShock(shock).catch(console.error)
                    }
                  }
                } catch {
                  // Malformed event — skip
                }
              }
            }
          }
        } catch (error) {
          // Reconnect with backoff
          send('reconnecting', {})
          setTimeout(connect, 2000)
        }
      }
      
      await connect()
      clearInterval(pingInterval)
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}

function normalizeOddsUpdate(raw: Record<string, unknown>) {
  // TODO: Map actual TxLINE odds SSE field names to OddsUpdate type
  // Check TxLINE API reference for exact field names in odds stream payload
  return {
    matchId: raw.matchId as string || raw.fixture_id as string,
    timestamp: Date.now(),
    market: 'match_winner',
    homeProb: Number(raw.homeProb || raw.home_probability || 0),
    awayProb: Number(raw.awayProb || raw.away_probability || 0),
    drawProb: Number(raw.drawProb || raw.draw_probability || 0),
    previousHomeProb: 0,
    previousAwayProb: 0,
    deltaHome: 0,
    deltaAway: 0,
  }
}
```

**IMPORTANT NOTE FOR AGENT:** The `normalizeOddsUpdate` function has placeholder field names. Before implementing, fetch the TxLINE API reference at `https://txline.txodds.com/api-reference` and check the exact field names in the odds SSE stream payload. Update the normalization accordingly.

**Done when:**
```
[ ] Browser EventSource connects to /api/odds-relay
[ ] Odds events fire in browser console during a live match (or use historical data for testing)
[ ] Shock events fire correctly when threshold is met
[ ] Keep-alive ping prevents connection timeout
[ ] JWT renewal works without breaking the stream
```

---

### Step 8: Scores Relay API Route

Build `src/app/api/scores-relay/route.ts`. Similar pattern to odds relay but for match events.

The scores relay:
- Connects to TxLINE scores SSE
- Maintains MatchState per matchId (updated on each event)
- Relays normalized MatchEvents to browser
- Keeps a short buffer of recent events (last 5 minutes) for shock context

**Done when:** Browser receives goal/card/corner events from scores relay during testing.

---

### Step 9: Supporting API Routes

**`/api/fixtures/route.ts`:**
- Calls `getFixtures()` from snapshots.ts
- Returns array of World Cup fixtures
- Caches for 60 seconds (fixtures don't change that fast)

**`/api/history/[matchId]/route.ts`:**
- Checks Supabase `lumiere_match_cache` first
- If cache miss: fetches `getOddsHistory()` + `getScoresHistory()` + merges + saves to cache
- Returns merged timeline sorted by timestamp

**`/api/explain/route.ts`:**
- POST endpoint: accepts shock data
- Calls LLM (Groq free tier recommended: `llama-3.1-8b-instant`)
- Prompt: "You are a football commentator. Write exactly ONE sentence explaining this odds movement to a non-technical fan. [shock data]. Do not mention numbers. Use plain English."
- Returns `{ explanation: string }`
- Falls back to template if LLM fails

**Done when:** All three routes return valid responses.

---

### Step 10: Supabase Setup

Build `src/lib/supabase.ts` and deploy schema.

```typescript
import { createClient } from '@supabase/supabase-js'
import type { OddsShock } from '../types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function saveShock(shock: OddsShock): Promise<void> {
  const { error } = await supabase.from('lumiere_shocks').insert([{
    match_id: shock.matchId,
    home_team: shock.homeTeam,
    away_team: shock.awayTeam,
    affected_team: shock.affectedTeam,
    direction: shock.direction,
    delta: shock.delta,
    window_seconds: shock.windowSeconds,
    pre_prob: shock.preProb,
    post_prob: shock.postProb,
    trigger_event: shock.triggerEvent,
    trigger_minute: shock.triggerMinute,
    explanation: shock.explanation,
    fired_at: new Date(shock.firedAt).toISOString(),
  }])
  if (error) throw error
}

export async function getShocksForMatch(matchId: string): Promise<OddsShock[]> {
  const { data, error } = await supabase
    .from('lumiere_shocks')
    .select('*')
    .eq('match_id', matchId)
    .order('fired_at', { ascending: true })
  if (error) throw error
  return (data || []).map(row => ({
    id: row.id,
    matchId: row.match_id,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    affectedTeam: row.affected_team,
    direction: row.direction,
    delta: Number(row.delta),
    windowSeconds: row.window_seconds,
    preProb: Number(row.pre_prob),
    postProb: Number(row.post_prob),
    triggerEvent: row.trigger_event,
    triggerMinute: row.trigger_minute,
    explanation: row.explanation,
    firedAt: new Date(row.fired_at).getTime(),
  }))
}

export async function cacheMatch(matchId: string, data: {
  homeTeam: string
  awayTeam: string
  matchDate: string
  oddsHistory: unknown
  scoresHistory: unknown
  shockCount: number
}): Promise<void> {
  await supabase.from('lumiere_match_cache').upsert([{
    match_id: matchId,
    home_team: data.homeTeam,
    away_team: data.awayTeam,
    match_date: data.matchDate,
    odds_history: data.oddsHistory,
    scores_history: data.scoresHistory,
    shock_count: data.shockCount,
  }])
}

export async function getCachedMatch(matchId: string) {
  const { data } = await supabase
    .from('lumiere_match_cache')
    .select('*')
    .eq('match_id', matchId)
    .single()
  return data
}

export { supabase }
```

**Deploy SQL schema** (from LUMIERE_PRD.md section 8.5) in Supabase SQL editor.

**Done when:** saveShock() inserts a row. getShocksForMatch() returns it. getCachedMatch() returns null on miss, data on hit.

---

## Phase 3 — Replay Engine

**Goal:** Any completed match can be replayed through the same callback interface as the live stream.

### Step 11: Replay Engine

Build `src/lib/replay-engine.ts`.

```typescript
import type { MatchEvent, OddsUpdate } from './txline/types'
import type { OddsShock, ReplayOptions, ReplayControls, StreamCallbacks } from '../types'
import { detectShock, resetDetector } from './shock-detector'

interface TimelineEntry {
  timestamp: number
  type: 'event' | 'odds'
  data: MatchEvent | OddsUpdate
}

export function startReplay(
  matchData: {
    matchId: string
    homeTeam: string
    awayTeam: string
    timeline: TimelineEntry[]
  },
  options: ReplayOptions,
  callbacks: StreamCallbacks
): ReplayControls {
  resetDetector(matchData.matchId)
  
  const { timeline } = matchData
  if (timeline.length === 0) throw new Error('Empty timeline')
  
  const matchStart = timeline[0].timestamp
  const matchEnd = timeline[timeline.length - 1].timestamp
  const duration = matchEnd - matchStart
  
  let currentIndex = 0
  let paused = false
  let stopped = false
  let virtualTime = matchStart
  let timer: NodeJS.Timeout | null = null
  
  // Maintain match state for shock detection
  const matchState = { homeTeam: matchData.homeTeam, awayTeam: matchData.awayTeam }
  const scoreState = { homeScore: 0, awayScore: 0, minute: 0, phase: 'NS' as const, corners: { home: 0, away: 0 }, yellowCards: { home: 0, away: 0 }, redCards: { home: 0, away: 0 } }
  
  function emitNext() {
    if (stopped || paused || currentIndex >= timeline.length) return
    
    const entry = timeline[currentIndex]
    
    if (options.speed === 0) {
      // Instant mode — emit everything synchronously
      while (currentIndex < timeline.length) {
        emitEntry(timeline[currentIndex])
        currentIndex++
      }
      return
    }
    
    const delay = (entry.timestamp - virtualTime) / options.speed
    virtualTime = entry.timestamp
    
    timer = setTimeout(() => {
      emitEntry(entry)
      currentIndex++
      emitNext()
    }, Math.max(0, delay))
  }
  
  function emitEntry(entry: TimelineEntry) {
    if (entry.type === 'event') {
      const event = entry.data as MatchEvent
      // Update score state
      if (event.type === 'goal') {
        if (event.team === 'home') scoreState.homeScore++
        else scoreState.awayScore++
      }
      scoreState.minute = event.minute
      callbacks.onMatchEvent(event, {
        matchId: matchData.matchId,
        ...matchState,
        ...scoreState,
        lastUpdated: entry.timestamp,
      })
    } else {
      const odds = entry.data as OddsUpdate
      callbacks.onOddsUpdate(odds)
      
      // Check for shock
      const shock = detectShock(odds, matchState)
      if (shock) {
        callbacks.onShock(shock)
      }
    }
  }
  
  // Start
  emitNext()
  
  return {
    pause: () => { paused = true; if (timer) clearTimeout(timer) },
    resume: () => { if (!paused) return; paused = false; emitNext() },
    seek: (timestamp: number) => {
      if (timer) clearTimeout(timer)
      resetDetector(matchData.matchId)
      currentIndex = timeline.findIndex(e => e.timestamp >= timestamp)
      if (currentIndex === -1) currentIndex = timeline.length
      virtualTime = timestamp
      if (!paused) emitNext()
    },
    stop: () => { stopped = true; if (timer) clearTimeout(timer) },
    getCurrentTime: () => virtualTime,
    getDuration: () => duration,
    isPlaying: () => !paused && !stopped,
  }
}

export async function buildTimeline(
  oddsHistory: OddsUpdate[],
  scoresHistory: MatchEvent[]
): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [
    ...oddsHistory.map(o => ({ timestamp: o.timestamp, type: 'odds' as const, data: o })),
    ...scoresHistory.map(e => ({ timestamp: e.timestamp, type: 'event' as const, data: e })),
  ]
  return entries.sort((a, b) => a.timestamp - b.timestamp)
}
```

**Done when:**
```
[ ] Replay fires events in correct chronological order
[ ] Shocks fire at correct relative timestamps
[ ] pause/resume/seek/stop all work
[ ] Instant mode emits all events synchronously
[ ] Callbacks are identical shape to live stream callbacks
```

---

### Step 12: Identify Best Demo Match

Build `scripts/find-demo-match.ts`:
- Fetches all completed World Cup fixtures
- For each completed match, fetches odds history
- Runs shock detection over full history
- Counts shocks per match
- Prints top 5 matches by shock count with details

Run this script. The match with the most shocks becomes `NEXT_PUBLIC_DEMO_MATCH_ID`.

**Done when:** `NEXT_PUBLIC_DEMO_MATCH_ID` is set in `.env.local`.

---

## Phase 4 — UI Components

**Goal:** All six components built, typed, styled, mobile-responsive.

### Design System (apply to globals.css)

```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Inter:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg:           #080808;
  --surface:      #0f0f0f;
  --border:       #1a1a1a;
  --text:         #f0f0f0;
  --muted:        #555555;
  --shock-red:    #ff2d2d;
  --shock-green:  #00e676;
  --accent:       #f5c518;
  --dim:          #2a2a2a;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', sans-serif;
}

.font-display { font-family: 'Space Grotesk', sans-serif; }
.font-mono { font-family: 'JetBrains Mono', monospace; }
```

### Step 13: ShockAlert Component

`src/components/ShockAlert.tsx`

The most important component. Full-screen on mobile, centered modal on desktop.

**Props:**
```typescript
interface ShockAlertProps {
  shock: OddsShock
  onDismiss: () => void
}
```

**Layout:**
```
[Large direction arrow — ▼ or ▲]
[Team name — huge, bold]
[Delta — e.g. "−18%" — 48px, shock-red or shock-green]
["in 47 seconds"]
[Divider]
[AI explanation sentence — plain text, 18px]
[Before/after bar — "was 40%" → "now 22%"]
[Tap to dismiss]
```

**Animation:** slides up from bottom with a subtle ease-out. Holds for 8 seconds. Auto-dismisses with slide-down. User tap/click dismisses immediately.

**Done when:** ShockAlert renders with mock data, animates correctly on mobile and desktop, dismisses after 8s.

---

### Step 14: OddsTimeline Component

`src/components/OddsTimeline.tsx`

Scrolling feed of smaller odds movements. Entries slide in from right.

**Props:**
```typescript
interface OddsTimelineProps {
  updates: OddsUpdate[]
  matchState: MatchState | null
}
```

**Each entry:**
- Timestamp (mono font)
- Team abbreviation
- Delta as colored pill (green = up, red = down)
- New probability
- Filter: hide deltas below 5%

**Done when:** Timeline renders, updates live as new events arrive, filters small movements.

---

### Step 15: MatchCard + MatchList Components

`src/components/MatchCard.tsx` and `src/components/MatchList.tsx`

**MatchCard props:**
```typescript
interface MatchCardProps {
  fixture: Fixture
  homeProb?: number
  awayProb?: number
  recentShock?: boolean  // pulse animation if shock in last 2min
  active?: boolean       // currently selected
  onClick: () => void
}
```

**Layout:**
- Teams side by side
- Score in center, large
- Probability bar below (home % | draw % | away %)
- Orange pulse dot if recentShock
- Subtle glow if active

**MatchList:** Horizontal scroll on mobile, grid on desktop. Shows all active + upcoming matches. Tapping a card selects it.

**Done when:** MatchList renders from fixtures data, MatchCard shows live probabilities, tap selects match.

---

### Step 16: ShockHistory Component

`src/components/ShockHistory.tsx`

Scrollable log of all shocks for the current match.

**Props:**
```typescript
interface ShockHistoryProps {
  shocks: OddsShock[]
}
```

**Each entry:**
- Match minute
- Team + delta
- Expandable: shows full explanation + before/after probs
- Color-coded by direction

**Done when:** History renders from Supabase data, entries expand on click.

---

### Step 17: ReplayControls + ProbabilityBar

**ReplayControls** (`src/components/ReplayControls.tsx`):
- Speed selector: 1x / 5x / 15x buttons
- Seek bar: scrub through match timeline
- Play/pause button
- Current time display (match minute)

**ProbabilityBar** (`src/components/ProbabilityBar.tsx`):
- Three-segment bar: home % | draw % | away %
- Animates on probability change (smooth transition)
- Team names and percentages on each side
- Highlighted in shock-red/green immediately after a shock

**Done when:** Both components render, ReplayControls interact with replay engine, ProbabilityBar animates live.

---

## Phase 5 — Pages + Full Integration

### Step 18: Landing Page

`src/app/page.tsx`

Single-screen landing. Explains LUMIÈRE in under 10 seconds.

**Content:**
```
[LUMIÈRE wordmark]
[Tagline: "The market knows before the commentator does."]
[One paragraph: what it is]
[Two CTAs: "Watch Live" → /watch, "See Demo" → /watch?demo=true]
[Visual: animated mock shock card firing]
```

The mock shock animation is purely CSS/JS — no API call. Shows a fake shock card appearing and disappearing every 6 seconds. This shows the product without requiring a live match.

**Done when:** Landing loads fast, mock animation runs, both CTAs work.

---

### Step 19: Watch Page (Main App)

`src/app/watch/page.tsx`

This is the primary product experience.

**Layout:**
- Top: MatchList (horizontal scroll)
- Middle: ProbabilityBar for selected match
- Bottom: OddsTimeline feed
- Overlay: ShockAlert when shock fires
- Side panel (desktop): ShockHistory

**Wiring:**
1. Load fixtures from `/api/fixtures`
2. User selects a match (or auto-select first active match)
3. Connect EventSource to `/api/odds-relay?matchId=X`
4. Connect EventSource to `/api/scores-relay?matchId=X`
5. Odds updates → OddsTimeline
6. Shocks → ShockAlert (queue if multiple fire simultaneously)
7. Match events → update MatchState → update ProbabilityBar
8. All shocks → ShockHistory

**Demo mode (`?demo=true`):**
- Skip match selector
- Load `NEXT_PUBLIC_DEMO_MATCH_ID`
- Connect to `/api/replay?matchId=${demoMatchId}&speed=5`
- Everything else identical

**Done when:** Full flow works end-to-end in browser. Shock fires, alert appears, history updates, probability bar animates.

---

### Step 20: Replay Page

`src/app/replay/[matchId]/page.tsx`

Same as watch page but for a specific historical match. Includes ReplayControls.

**Done when:** Any completed match replays correctly with speed control and seek.

---

### Step 21: Replay API Route

`src/app/api/replay/route.ts`

- Accepts `?matchId=X&speed=N`
- Loads historical data from cache (or fetches + caches)
- Builds timeline using `buildTimeline()`
- Runs `startReplay()` and emits events as SSE in same format as live relays
- Browser code is identical for live and replay

**Done when:** `/api/replay?matchId=X&speed=5` streams events to browser in correct order.

---

## Phase 6 — Polish + Deploy

### Step 22: Mobile Polish

Test on mobile viewport (375px width):
- ShockAlert fills full screen
- MatchList scrolls horizontally
- Probability bar readable
- All text legible at mobile sizes
- Touch targets at least 44px

### Step 23: Demo Mode Verification

1. Open `localhost:3000/watch?demo=true`
2. No user input required
3. Match auto-loads and starts replaying at 5x
4. At least 3 shocks fire during the demo match
5. Each shock: alert appears, explanation shows, history updates
6. Full replay completes without errors

### Step 24: Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Environment variables to set in Vercel dashboard:**
```
TXLINE_API_TOKEN
TXLINE_GUEST_JWT
TXLINE_API_BASE
TXLINE_API_ORIGIN
SUPABASE_SERVICE_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_DEMO_MATCH_ID
OPENAI_API_KEY (or GROQ_API_KEY)
```

**Done when:**
```
[ ] https://lumiere.vercel.app loads
[ ] https://lumiere.vercel.app/watch?demo=true runs the full demo
[ ] Mobile tested on real device
[ ] No console errors in production
```

### Step 25: Live Match Recording

During France vs Spain (July 14) or Argentina vs Switzerland (July 12):
1. Open LUMIÈRE on live match
2. Record screen for the full match (or until a shock fires)
3. Capture at least one real shock alert firing
4. This clip goes in the demo video

### Step 26: Demo Video

Structure (5 minutes max):
1. (0:00–0:20) Landing page. "LUMIÈRE tells you what the market thinks is happening — in real time."
2. (0:20–1:00) Live clip: real shock firing during a real match.
3. (1:00–3:30) Demo mode: open `/watch?demo=true`, narrate as shocks fire. Explain what each shock means.
4. (3:30–4:00) Show on mobile — looks great on a phone.
5. (4:00–4:30) Show shock history — the arc of the match's drama.
6. (4:30–5:00) TxLINE powers all of it. One sentence on technical approach.

Upload to YouTube (unlisted) or Loom. Link in submission.

---

## Full Done Checklist

```
INFRASTRUCTURE
[ ] TxLINE Service Level 12 activated (mainnet)
[ ] TXLINE_API_TOKEN in .env.local
[ ] getFixtures() returns World Cup matches
[ ] Odds SSE relay connects and streams to browser
[ ] Scores SSE relay connects and streams to browser
[ ] JWT auto-renewal on 401 works
[ ] Supabase schema deployed

SHOCK DETECTION
[ ] Shock fires correctly at 15%/90s threshold
[ ] Shock does NOT fire below threshold
[ ] Shocks saved to lumiere_shocks table
[ ] AI explanation generated for each shock (with template fallback)

REPLAY ENGINE
[ ] buildTimeline() merges odds + scores history correctly
[ ] startReplay() at 5x speed emits events in order
[ ] Shocks fire at correct timestamps during replay
[ ] pause/resume/seek/stop work
[ ] Demo match identified and set as env var

UI COMPONENTS
[ ] ShockAlert: animates in, shows all data, auto-dismisses in 8s
[ ] OddsTimeline: live updates, filters <5% movements
[ ] MatchCard: shows score, probability bar, pulse on recent shock
[ ] MatchList: renders fixtures, tap selects
[ ] ShockHistory: shows all shocks, expandable
[ ] ReplayControls: speed, seek, play/pause
[ ] ProbabilityBar: animates on change
[ ] All components mobile-responsive

PAGES
[ ] Landing page loads, mock animation runs, CTAs work
[ ] Watch page: full live flow works end-to-end
[ ] Watch page: demo mode auto-plays without user input
[ ] Replay page: historical match replays with controls

DEPLOY
[ ] Vercel deployment live
[ ] Demo mode works on live URL
[ ] Mobile tested on real device
[ ] Live match recording captured
[ ] Demo video recorded and uploaded
[ ] GitHub repo public with README
[ ] Superteam Earn submission completed
[ ] Submitted before July 19 23:59 UTC
```

---

## Agent Prompt (paste to Claude Code / Antigravity)

---

You are building **LUMIÈRE** — a real-time odds intelligence companion for World Cup fans. Read `LUMIERE_PRD.md` and `LUMIERE_BUILD.md` fully before writing a single line of code.

**Framework:** Next.js 16.2 with TypeScript and Tailwind CSS. Never use Turbopack. Always use `--webpack` flag.

**Critical rules:**
1. No `any` types anywhere. Every type is in `src/lib/txline/types.ts` or `src/types/index.ts`.
2. TxLINE credentials (`TXLINE_API_TOKEN`, `X-Api-Token` header) are server-only — never expose in browser code. All TxLINE connections happen in API routes.
3. The SSE relay routes (`/api/odds-relay`, `/api/scores-relay`) must handle JWT renewal on 401 without breaking the stream.
4. The replay engine callbacks must be identical in shape to live stream callbacks — components cannot tell the difference between live and replay.
5. Shock detection runs server-side only, in the odds relay route.
6. Run `npx tsc --noEmit` after every phase. Fix all errors before proceeding.
7. The `?demo=true` mode must work without any user input — auto-loads the demo match, auto-plays, shocks fire automatically.

**TxLINE auth:** Two headers required on every data request:
- `Authorization: Bearer ${jwt}` — from `POST /auth/guest/start`, expires, auto-renewed on 401
- `X-Api-Token: ${apiToken}` — from `.env.local` as `TXLINE_API_TOKEN`, long-lived

**Shock definition:** Fires when win probability shifts ≥15% within a 90-second rolling window. Server-side detection in the odds relay route.

**Build in exact phase order:** Phase 1 → 2 → 3 → 4 → 5 → 6. Confirm each phase passes its done checklist before starting the next.

**Before implementing any TxLINE API call**, check the actual field names in TxLINE's API reference. The field names in this document are best guesses — verify them against `https://txline.txodds.com/api-reference` before writing normalization code.

Start with Phase 1, Step 1: project scaffold. Confirm when `npm run build -- --webpack` passes on the empty scaffold.

---

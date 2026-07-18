# LUMIERE

**Feel the World Cup through the market.**

LUMIERE is a live football companion powered by TxLINE. It turns goals, red cards and sharp odds movement into a second-screen fan experience: when the market moves sharply, LUMIERE explains what changed in plain football language and opens a short **Follow or Fade** challenge. Five TxLINE event-minutes later, the market resolves the call and a verified result updates the fan's Market IQ.

It also supports TxLINE-verified Match Winner code edges, public code tracking, and Telegram group delivery.

Built for the TxODDS World Cup Hackathon, Consumer & Fan Experiences track, July 2026.

## Two match modes

- **Following Mode** — for fans away from the television. The match becomes a full-screen vertical feed of goals, red cards, odds shocks and momentum moments. Swipe card to card (a position counter and swipe hint keep the feed discoverable); new moments scroll into view on arrival.
- **Watching Mode** — a quiet second screen. Score, match clock and live Match Winner chances stay visible, with a one-line market reading underneath ("The market is calm", "Momentum is building", "Odds shock — the market is reacting to the goal"). Shocks slide up as bottom sheets and briefly light up the chances bar.

A persistent header badge shows the session state: 🟢 Live or 🔁 Replay (recorded data, practice only).

## The market story

Every shock tells its story. When an odds shock fires shortly after a goal, red card or penalty, LUMIERE connects the two on the card:

```text
⚽ Goal 67'  →  ⚡ Market shock
"The market is reacting to Argentina's goal in the 67' —
bookmakers now believe they've taken control."
```

The attribution is inferred presentation-side from the same TxLINE event timestamps used everywhere else — detection, scoring and settlement are untouched by it. When no match event explains the move, LUMIERE says so instead of inventing one.

## Core fan loop

```text
TxLINE odds SSE
  -> normalized full-match 1X2 probability
  -> 15 percentage-point / 90-second shock detector
  -> Follow or Fade fan call
  -> first TxLINE 1X2 tick after five event-minutes
  -> immutable Market IQ event
  -> profile, leaderboard and Telegram result
```

The live interface shows the TxLINE update count, event timestamps and connection state (`live`, `reconnecting`, or `stale`). Replays use recorded TxLINE events and the same rules, but are practice-only and never affect the leaderboard.

## Implemented product

- **Follow/Fade:** one call per user per live shock. Correct `+10 IQ`, wrong `-5 IQ`, close result is a push. Results land as an animated verdict with the plain-English outcome and the fan's current win streak.
- **Auditable Market IQ:** every score change has a unique source event; reconnects and concurrent relays cannot award points twice.
- **Market IQ profile:** accuracy, current and best streak, correct/wrong/push counts, recent call history and leaderboard position — all derived from the same verified call records, presentation-only.
- **Market Personality:** a descriptive label (Contrarian, Momentum Rider, Market Whisperer, Market Reader) computed from at least 10 decided verified calls; below that threshold the profile honestly shows "Market Observer". Never affects scoring.
- **Odds shocks:** a home or away win probability moving at least 15 percentage points inside 90 feed-seconds.
- **Verified edge builder:** supports TxLINE Match Winner only (`home`, `draw`, `away`). Unsupported market schemas are hidden instead of estimated.
- **Automatic code settlement:** final TxLINE score states settle selections server-side. There is no public settlement endpoint.
- **Public tracking:** code pages poll current scores and final results. One browser counts as one view rather than every poll counting again.
- **Telegram login:** the sign-in page opens `@LumiereWorldCupBot`; `/start` sends a signed, ten-minute `LUM1...` browser-bound code.
- **Telegram groups:** code-link expansion, current odds, recent shocks, Market IQ leaderboard, per-match group subscriptions and final code result notifications.
- **Guest demo:** no account required. It replays real recorded TxLINE data at accelerated speed and completes a practice Follow/Fade loop with a shareable result.

## Live application

- App: [https://lumiereworldcup.vercel.app](https://lumiereworldcup.vercel.app)
- Demo: [https://lumiereworldcup.vercel.app/watch?demo=true](https://lumiereworldcup.vercel.app/watch?demo=true)
- Bot: `@LumiereWorldCupBot`

## TxLINE endpoints used

These are the upstream TxLINE paths used by the server, not LUMIERE's internal browser routes.

| TxLINE path | Use |
|---|---|
| `GET /fixtures/snapshot` | World Cup fixtures and orientation |
| `GET /scores/stream` | Live score state and match events |
| `GET /odds/stream` | Live consensus odds, shock detection and call resolution |
| `GET /scores/snapshot/{fixtureId}` | Current/final score state and settlement recovery |
| `GET /odds/snapshot/{fixtureId}` | Current Match Winner probabilities and edge verification |
| `GET /scores/historical/{fixtureId}` | Historical score records when available |
| `GET /scores/updates/{epochDay}/{hour}/{interval}` | Replay history fallback |
| `GET /odds/updates/{epochDay}/{hour}/{interval}` | Replay odds history |

Both live streams and replay records pass through the same normalizers in `src/lib/txline`.

## Telegram commands

| Command | Result |
|---|---|
| `/start` | Welcome message or signed login code |
| `/status` | Bot/application health |
| `/odds Argentina` | Current TxLINE 1X2 market |
| `/shock [team]` | Current market for a team, or recent shocks without a team |
| `/followmatch Argentina` | Subscribe the current group to major shocks for that fixture |
| `/unfollowmatch [team]` | Remove one or all group subscriptions |
| `/mycode` | The Telegram user's latest codes |
| `/leaderboard` | Market IQ leaderboard |

Telegram group privacy must be disabled in BotFather for automatic link expansion. This is a Telegram account setting and cannot be changed by application code.

## Security and integrity

- TxLINE, Supabase service-role, Telegram and Groq credentials are server-only.
- Code creation recomputes probability and edge from TxLINE; client-supplied edge values are not trusted.
- Selection settlement is derived from final TxLINE scores, never from a public request body.
- Follow/Fade entry probability comes from the persisted shock; resolution probability comes from a future TxLINE event.
- Database unique constraints make shocks, market calls, IQ events and Telegram broadcasts idempotent.
- Live calls close after 30 seconds. Historical replay calls are local practice and cannot affect Market IQ.

## Commercial integrations

The free fan experience is functional without a commercial partner.

- **Affiliate attribution:** approved HTTPS destination templates can be configured per platform. Buttons stay hidden until `NEXT_PUBLIC_AFFILIATE_LINKS_ENABLED=true`; every redirect is recorded. Partner approval and URLs are manual requirements.
- **Sponsored market moments:** a sponsor name/link can be configured without changing code. No sponsor is displayed when unset.
- **B2B export:** `GET /api/data/market-intelligence` returns an anonymized shocks/calls/selections dataset with a bearer secret.
- **Premium creator subscriptions:** roadmap only. The application does not claim to sell subscriptions today.

LUMIERE never accepts stakes or places bets. Operators are responsible for affiliate approval, age gating and jurisdiction-specific compliance before enabling bookmaker destinations.

## Stack

- Next.js 16.2, React 19, TypeScript and Tailwind CSS
- TxLINE Service Level 12 mainnet data
- Supabase Auth and Postgres
- Telegram Bot API with a Vercel webhook
- Groq for one-sentence shock explanations, with a deterministic fallback
- Solana activation through `scripts/activate.ts`

## Local setup

```bash
npm install
cp .env.example .env.local
npm run activate
```

Run `supabase/schema.sql` in the Supabase SQL editor before deploying application code, then:

```bash
npm run setup-telegram
npm run dev
```

## Verification

```bash
npm run typecheck
npm run test:market-calls
npm run test:replay-integrity
npm run test:replay-route
npm run test:replay-soak
npm run build
```

`npm run setup-telegram` verifies that the bot token belongs to the configured username before registering the webhook and command list.

## TxLINE feedback

The normalized live streams and time-bucket history make it possible to run one product pipeline in both live and replay modes. The main friction was discovering which market identifiers were present in actual World Cup payloads. LUMIERE therefore exposes Match Winner edge only and reports unavailable markets honestly. Versioned payload examples for each competition and market would reduce that discovery time.

Built by Divine ([@TheWeirdDee](https://github.com/TheWeirdDee)), Lagos, Nigeria, 2026.

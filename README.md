# Blackjak

A multiplayer blackjack party game for up to 6 players per table, styled after Balatro: swirling pixel-paint felt, chunky pixel type, chips × mult scoring, and cards that fly out of the shoe, flip, sway and tilt under your cursor.

## Playing

1. Open the site, type a name and press **Create table**.
2. Share the 4-letter code (or the **Copy invite link** button) with friends.
3. The host presses **Start game**. Everyone picks chips and presses **Deal me in**. The deal starts when everybody is in, or 15 seconds after the first bet.
4. On your turn: **Hit**, **Stand**, **Double** or **Split**. You have 25 seconds before the table stands for you.

### House rules

Standard European casino blackjack, as played at the Spielbanken Bayern:

- Six 52-card decks, reshuffled when the cut card (75% penetration) comes out.
- Aces count 1 or 11, face cards 10, everything else its face value.
- No hole card: the dealer takes one card, and draws the rest after every player is done.
- Dealer draws to 16 and stands on every 17.
- Blackjack pays 3:2, other wins 1:1, ties push. A dealer blackjack beats every other hand, including doubles and splits.
- Double down on 9, 10 or 11. Split a pair once; split aces get one card each.
- Everyone starts with $1,000. Drop below the $10 minimum and the house bails you out with $500.

## Tech

- **Next.js (App Router) + TypeScript**, deployed on Vercel.
- **Realtime: Upstash Redis + short polling.** Vercel functions can't hold websockets, so the authoritative game state lives in Redis and each client polls `GET /api/rooms/:code` (about every 0.7 s during a hand). Moves are `POST`s that take a short Redis lock, apply the rules in `lib/game.ts`, and save. Timers (bet window, turn clock, results screen) are deadlines in the state that the next poll advances, so no background worker is needed.
- Cards carry a server timestamp for when they become visible, which is how every client animates the deal in the same order.
- The shoe and player tokens never leave the server (`publicView` strips them).
- Animations: framer-motion springs for dealing and UI pops, CSS keyframes for idle sway, WebGL fragment shader for the background, Web Audio for synthesized sound effects.

```
app/                 pages and API routes
  api/rooms/         create a table
  api/rooms/[code]/  poll state (GET) and send moves (POST)
components/          Table, PlayingCard, SwirlBackground, Home, Juice (count-ups, bursts)
lib/cards.ts         shoe, hand totals
lib/game.ts          rules engine (pure, unit tested)
lib/store.ts         Upstash Redis storage with an in-memory fallback for local dev
tests/               vitest tests for the rules
graphify-out/        knowledge graph of this repo (see below)
```

## Deploying on Vercel

1. On vercel.com, **Add New → Project** and import `davdx140/Blackjak`. The defaults (Next.js) are right.
2. In the project, open **Storage → Create Database → Upstash for Redis** (free tier is fine) and connect it to the project. That sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
3. Redeploy so the functions pick up the variables.

Without step 2 the site still loads, but each serverless instance has its own memory, so players won't see each other. The table shows a red warning when that happens.

### Environment variables

| Name | Required | What it is |
| --- | --- | --- |
| `KV_REST_API_URL` | yes, on Vercel | Upstash Redis REST URL (set automatically by the Vercel Upstash integration) |
| `KV_REST_API_TOKEN` | yes, on Vercel | Upstash Redis REST token (set automatically) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | alternative | Used if you create the database on upstash.com yourself |

## Local development

```bash
npm install
npm run dev      # http://localhost:3000, in-memory storage, no setup
npm test         # rules engine tests
```

Open two browser windows (or one private window) to play against yourself.

## Codebase knowledge graph

`graphify-out/` holds a [graphify](https://github.com/safishamsi/graphify) knowledge graph of this repository: `GRAPH_REPORT.md` is the readable summary and `graph.json` the full graph. Read `GRAPH_REPORT.md` first to get oriented before changing code. Regenerate it after larger changes with:

```bash
pip install graphifyy
graphify update .
```

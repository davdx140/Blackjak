# Graph Report - blackjak  (2026-10-12)

## Corpus Check
- 21 files · ~11,075 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 217 nodes · 475 edges · 10 communities (9 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f8749412`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Table.tsx
- game.ts
- [code]/route.ts
- package.json
- compilerOptions
- cards.ts
- Blackjak
- next
- Home.tsx
- CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `TableView()` - 16 edges
2. `compilerOptions` - 16 edges
3. `handTotal()` - 15 edges
4. `POST()` - 12 edges
5. `Table()` - 12 edges
6. `act()` - 12 edges
7. `tick()` - 11 edges
8. `withRoom()` - 10 edges
9. `isBlackjack()` - 9 edges
10. `GameError` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Tech` --references--> `publicView()`  [INFERRED]
  README.md → lib/game.ts
- `GET()` --calls--> `tick()`  [EXTRACTED]
  app/api/rooms/[code]/route.ts → lib/game.ts
- `POST()` --calls--> `act()`  [EXTRACTED]
  app/api/rooms/[code]/route.ts → lib/game.ts
- `POST()` --calls--> `removePlayer()`  [EXTRACTED]
  app/api/rooms/[code]/route.ts → lib/game.ts
- `POST()` --calls--> `tick()`  [EXTRACTED]
  app/api/rooms/[code]/route.ts → lib/game.ts

## Import Cycles
- None detected.

## Communities (10 total, 1 thin omitted)

### Community 0 - "Table.tsx"
Cohesion: 0.15
Nodes (26): Burst(), CountUp(), WavyText(), CHIP_VALUES, Controls(), EMOJIS, HandView(), Loading() (+18 more)

### Community 1 - "game.ts"
Cohesion: 0.10
Nodes (38): handLabel(), buildShoe(), Card, cardValue(), handTotal(), isBlackjack(), isBust(), act() (+30 more)

### Community 2 - "[code]/route.ts"
Cohesion: 0.15
Nodes (28): Ctx, dynamic, GET(), POST(), view(), dynamic, newCode(), POST() (+20 more)

### Community 3 - "package.json"
Cohesion: 0.06
Nodes (30): dependencies, framer-motion, nanoid, next, react, react-dom, @upstash/redis, devDependencies (+22 more)

### Community 4 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 5 - "cards.ts"
Cohesion: 0.20
Nodes (14): CardBack(), CardFace(), FACE, PIPS, PlayingCard(), Props, DECKS, isRed() (+6 more)

### Community 6 - "Blackjak"
Cohesion: 0.22
Nodes (8): Blackjak, Codebase knowledge graph, Deploying on Vercel, Environment variables, House rules, Local development, Playing, Tech

### Community 7 - "next"
Cohesion: 0.25
Nodes (4): metadata, viewport, nextConfig, next

### Community 8 - "Home.tsx"
Cohesion: 0.13
Nodes (24): Page(), RoomPage(), FAN, Home(), Mood, PALETTES, SwirlBackground(), JoinGate() (+16 more)

## Knowledge Gaps
- **6 isolated node(s):** `nanoid`, `react-dom`, `@types/node`, `@types/react`, `@types/react-dom` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 82 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `Home.tsx`, `Table.tsx`, `[code]/route.ts`, `package.json`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **What connects `nanoid`, `react-dom`, `@types/node` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `game.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09856035437430787 - nodes in this community are weakly interconnected._
- **Why does `publicView()` connect `[code]/route.ts` to `game.ts`, `Blackjak`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Should `[code]/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14623655913978495 - nodes in this community are weakly interconnected._
- **Why does `Tech` connect `Blackjak` to `[code]/route.ts`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
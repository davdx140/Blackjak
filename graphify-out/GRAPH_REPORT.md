# Graph Report - blackjak  (2026-10-12)

## Corpus Check
- 23 files · ~11,191 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 226 nodes · 487 edges · 9 communities (7 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a7fe24b6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Table.tsx
- game.ts
- store.ts
- package.json
- compilerOptions
- Home.tsx
- Blackjak
- vercel.json
- CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `TableView()` - 16 edges
2. `compilerOptions` - 16 edges
3. `handTotal()` - 15 edges
4. `POST()` - 13 edges
5. `Table()` - 12 edges
6. `act()` - 12 edges
7. `tick()` - 11 edges
8. `withRoom()` - 10 edges
9. `isBlackjack()` - 9 edges
10. `GameError` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Tech` --references--> `publicView()`  [INFERRED]
  README.md → lib/game.ts
- `GET()` --calls--> `loadRoom()`  [EXTRACTED]
  app/api/rooms/[code]/route.ts → lib/store.ts
- `GET()` --calls--> `withRoom()`  [EXTRACTED]
  app/api/rooms/[code]/route.ts → lib/store.ts
- `POST()` --calls--> `withRoom()`  [EXTRACTED]
  app/api/rooms/[code]/route.ts → lib/store.ts
- `POST()` --calls--> `addPlayer()`  [EXTRACTED]
  app/api/rooms/route.ts → lib/game.ts

## Import Cycles
- None detected.

## Communities (9 total, 2 thin omitted)

### Community 0 - "Table.tsx"
Cohesion: 0.09
Nodes (44): Page(), RoomPage(), Home(), Burst(), CountUp(), WavyText(), CardBack(), PlayingCard() (+36 more)

### Community 1 - "game.ts"
Cohesion: 0.09
Nodes (50): Ctx, dynamic, GET(), notFound(), POST(), view(), handLabel(), ScoreBox() (+42 more)

### Community 2 - "store.ts"
Cohesion: 0.11
Nodes (21): dynamic, dynamic, newCode(), POST(), metadata, viewport, createRoom(), acquire() (+13 more)

### Community 3 - "package.json"
Cohesion: 0.06
Nodes (31): dependencies, framer-motion, nanoid, next, react, react-dom, @upstash/redis, devDependencies (+23 more)

### Community 4 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 5 - "Home.tsx"
Cohesion: 0.13
Nodes (22): FAN, CardFace(), FACE, PIPS, Props, Mood, PALETTES, DECKS (+14 more)

### Community 6 - "Blackjak"
Cohesion: 0.22
Nodes (8): Blackjak, Codebase knowledge graph, Deploying on Vercel, Environment variables, House rules, Local development, Playing, Tech

## Knowledge Gaps
- **6 isolated node(s):** `nanoid`, `react-dom`, `@types/node`, `@types/react`, `@types/react-dom` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 87 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `store.ts` to `Table.tsx`, `game.ts`, `package.json`, `Home.tsx`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **What connects `nanoid`, `react-dom`, `@types/node` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Table.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08928571428571429 - nodes in this community are weakly interconnected._
- **Why does `publicView()` connect `game.ts` to `Blackjak`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Should `game.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09480519480519481 - nodes in this community are weakly interconnected._
- **Why does `Tech` connect `Blackjak` to `game.ts`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11330049261083744 - nodes in this community are weakly interconnected._
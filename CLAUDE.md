# Blackjak

Before working in this repo, read `graphify-out/GRAPH_REPORT.md`: it is a knowledge graph summary of the codebase (core functions, how modules connect). Use `graphify query "<question>"` or `graphify explain "<symbol>"` against `graphify-out/graph.json` for details (`pip install graphifyy`).

After changing code, regenerate the graph with `graphify update .` and commit `graphify-out/` alongside the change.

- Rules engine: `lib/game.ts` (pure, tested in `tests/game.test.ts`). Keep it free of I/O.
- Storage: `lib/store.ts` (Upstash Redis, in-memory fallback locally).
- Realtime is polling against `app/api/rooms/[code]/route.ts`; Vercel functions can't hold websockets.
- Run `npm test` and `npx tsc --noEmit` before committing.

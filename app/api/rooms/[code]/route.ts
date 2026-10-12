import { NextResponse } from "next/server";
import {
  act,
  addPlayer,
  confirmBet,
  GameError,
  placeBet,
  publicView,
  react,
  removePlayer,
  startGame,
  tick,
  type Action,
  type Room,
} from "@/lib/game";
import { loadRoom, storageKind, withRoom } from "@/lib/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/** Only write lastSeen this often, so a poll is usually a single read. */
const PRESENCE_EVERY = 8_000;

function view(room: Room) {
  return NextResponse.json(
    { room: publicView(room, Date.now()), storage: storageKind },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(req: Request, { params }: Ctx) {
  const code = (await params).code.toUpperCase();
  const pid = new URL(req.url).searchParams.get("pid");
  const now = Date.now();
  const room = await loadRoom(code);
  if (!room) return NextResponse.json({ error: "Table not found" }, { status: 404 });

  // Dry-run the timers on a copy; only take the lock if something is due.
  const probe = structuredClone(room);
  const due = tick(probe, now);
  const me = room.players.find((p) => p.id === pid);
  const stale = me && now - me.lastSeen > PRESENCE_EVERY;
  if (!due && !stale) return view(room);

  try {
    const res = await withRoom(code, (r) => {
      const t = Date.now();
      const p = r.players.find((x) => x.id === pid);
      if (p) p.lastSeen = t;
      tick(r, t);
      return true;
    });
    return res ? view(res.room) : NextResponse.json({ error: "Table not found" }, { status: 404 });
  } catch {
    return view(room);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const code = (await params).code.toUpperCase();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const playerId = String(body.playerId ?? "");
  const token = String(body.token ?? "");
  const type = String(body.type ?? "");
  if (!playerId || !token) return NextResponse.json({ error: "Missing player" }, { status: 400 });

  try {
    const res = await withRoom(code, (room) => {
      const now = Date.now();
      tick(room, now);
      if (type === "join") {
        addPlayer(room, { id: playerId, token, name: String(body.name ?? "") }, now);
        return true;
      }
      const player = room.players.find((p) => p.id === playerId);
      if (!player || player.token !== token) throw new GameError("You're not at this table");
      player.lastSeen = now;
      switch (type) {
        case "start":
          startGame(room, playerId, now);
          break;
        case "bet":
          placeBet(room, player, Number(body.amount), now);
          break;
        case "confirm":
          confirmBet(room, player, now);
          break;
        case "action":
          act(room, player, body.action as Action, now);
          break;
        case "react":
          react(room, player, String(body.emoji ?? ""), now);
          break;
        case "leave":
          removePlayer(room, playerId, now);
          break;
        case "ping":
          break;
        default:
          throw new GameError("Unknown request");
      }
      return true;
    });
    if (!res) return NextResponse.json({ error: "Table not found" }, { status: 404 });
    return view(res.room);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong";
    return NextResponse.json({ error: msg }, { status: e instanceof GameError ? 400 : 500 });
  }
}

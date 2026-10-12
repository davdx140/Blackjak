import { NextResponse } from "next/server";
import { addPlayer, createRoom } from "@/lib/game";
import { createRoomRecord, withRoom } from "@/lib/store";

export const dynamic = "force-dynamic";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function newCode() {
  let s = "";
  for (let i = 0; i < 4; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { playerId, token, name } = body as { playerId?: string; token?: string; name?: string };
  if (!playerId || !token) return NextResponse.json({ error: "Missing player" }, { status: 400 });
  const now = Date.now();
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = newCode();
    if (await createRoomRecord(createRoom(code, now))) {
      await withRoom(code, (room) => addPlayer(room, { id: playerId, token, name: String(name ?? "") }, now));
      return NextResponse.json({ code });
    }
  }
  return NextResponse.json({ error: "Could not create a table, try again" }, { status: 503 });
}

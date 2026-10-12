import { Redis } from "@upstash/redis";
import type { Room } from "./game";

/**
 * Room storage. On Vercel, serverless functions don't share memory and can't
 * hold websockets, so room state lives in Upstash Redis (REST API) and clients
 * poll it. Locally, with no Redis configured, an in-process Map is used so
 * `npm run dev` works with zero setup.
 */

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token, automaticDeserialization: false }) : null;

/** "unconfigured" means we're deployed on Vercel without Redis: multiplayer won't sync. */
export const storageKind: "redis" | "memory" | "unconfigured" = redis ? "redis" : process.env.VERCEL ? "unconfigured" : "memory";

const ROOM_TTL_S = 60 * 60 * 6;
const LOCK_TTL_MS = 4000;

type Mem = { rooms: Map<string, string>; locks: Map<string, number> };
const g = globalThis as unknown as { __blackjakMem?: Mem };
const mem: Mem = (g.__blackjakMem ??= { rooms: new Map(), locks: new Map() });

const key = (code: string) => `blackjak:room:${code}`;
const lockKey = (code: string) => `blackjak:lock:${code}`;

export async function loadRoom(code: string): Promise<Room | null> {
  const raw = redis ? await redis.get<string>(key(code)) : mem.rooms.get(key(code));
  return raw ? (JSON.parse(raw) as Room) : null;
}

async function saveRoom(room: Room) {
  const raw = JSON.stringify(room);
  if (redis) await redis.set(key(room.code), raw, { ex: ROOM_TTL_S });
  else mem.rooms.set(key(room.code), raw);
}

export async function roomExists(code: string) {
  return redis ? (await redis.exists(key(code))) === 1 : mem.rooms.has(key(code));
}

export async function createRoomRecord(room: Room) {
  if (redis) {
    const ok = await redis.set(key(room.code), JSON.stringify(room), { ex: ROOM_TTL_S, nx: true });
    return ok === "OK";
  }
  if (mem.rooms.has(key(room.code))) return false;
  mem.rooms.set(key(room.code), JSON.stringify(room));
  return true;
}

async function acquire(code: string, owner: string): Promise<boolean> {
  for (let i = 0; i < 40; i++) {
    if (redis) {
      const ok = await redis.set(lockKey(code), owner, { nx: true, px: LOCK_TTL_MS });
      if (ok === "OK") return true;
    } else {
      const until = mem.locks.get(code) ?? 0;
      if (until < Date.now()) {
        mem.locks.set(code, Date.now() + LOCK_TTL_MS);
        return true;
      }
    }
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 40));
  }
  return false;
}

async function release(code: string, owner: string) {
  if (redis) {
    // Only delete the lock if we still own it.
    await redis.eval(
      `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
      [lockKey(code)],
      [owner],
    );
  } else mem.locks.delete(code);
}

/**
 * Load a room under a lock, let `fn` mutate it, and save it back. `fn` returns
 * false to skip the write (nothing changed).
 */
export async function withRoom<T>(code: string, fn: (room: Room) => T | false): Promise<{ room: Room; out: T | false } | null> {
  const owner = Math.random().toString(36).slice(2);
  if (!(await acquire(code, owner))) throw new Error("Table is busy, try again");
  try {
    const room = await loadRoom(code);
    if (!room) return null;
    const out = fn(room);
    if (out !== false) {
      room.version++;
      await saveRoom(room);
    }
    return { room, out };
  } finally {
    await release(code, owner);
  }
}

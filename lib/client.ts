"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicRoom } from "./game";

export interface Identity {
  playerId: string;
  token: string;
  name: string;
}

function rid(n = 16) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => (b % 36).toString(36)).join("");
}

export function getIdentity(): Identity {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem("blackjak:id");
  } catch {}
  if (raw) {
    try {
      return JSON.parse(raw) as Identity;
    } catch {}
  }
  const id: Identity = { playerId: rid(12), token: rid(24), name: "" };
  saveIdentity(id);
  return id;
}

export function saveIdentity(id: Identity) {
  try {
    localStorage.setItem("blackjak:id", JSON.stringify(id));
  } catch {}
}

export async function api<T = { room: PublicRoom; storage: string }>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}

/**
 * Poll a room. Vercel functions can't keep sockets open, so we poll quickly
 * while a hand is being played and more slowly while waiting around.
 */
export function useRoom(code: string, id: Identity | null) {
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storage, setStorage] = useState<string>("");
  const offset = useRef(0);
  const version = useRef(-1);
  const roomRef = useRef<PublicRoom | null>(null);

  const accept = useCallback((r: PublicRoom, s: string) => {
    offset.current = r.now - Date.now();
    setStorage(s);
    // Ignore stale responses that raced a newer one.
    if (roomRef.current && r.version < roomRef.current.version) return;
    if (r.version !== version.current || !roomRef.current) {
      version.current = r.version;
      roomRef.current = r;
      setRoom(r);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const r = await api(`/api/rooms/${code}?pid=${id.playerId}`);
        if (stop) return;
        accept(r.room, r.storage);
        setError(null);
      } catch (e) {
        if (!stop) setError((e as Error).message);
      }
      if (stop) return;
      const phase = roomRef.current?.phase;
      const hidden = typeof document !== "undefined" && document.hidden;
      const delay = hidden ? 4000 : phase === "playing" || phase === "results" ? 700 : 1200;
      timer = setTimeout(poll, delay);
    };
    poll();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [code, id, accept]);

  const send = useCallback(
    async (type: string, extra: Record<string, unknown> = {}) => {
      if (!id) return;
      const r = await api(`/api/rooms/${code}`, { ...extra, type, playerId: id.playerId, token: id.token });
      accept(r.room, r.storage);
      return r.room;
    },
    [code, id, accept],
  );

  return { room, error, storage, send, offset };
}

/** Server-synchronised clock, re-rendering about 12 times a second. */
export function useServerNow(offset: React.MutableRefObject<number>) {
  const [now, setNow] = useState(() => Date.now() + offset.current);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset.current), 80);
    return () => clearInterval(t);
  }, [offset]);
  return now;
}

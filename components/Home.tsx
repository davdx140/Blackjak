"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Rank, Suit } from "@/lib/cards";
import { api, getIdentity, Identity, saveIdentity } from "@/lib/client";
import { sfx } from "@/lib/sound";
import { CardFace } from "./PlayingCard";
import SwirlBackground from "./SwirlBackground";

const FAN: { r: Rank; s: Suit }[] = [
  { r: "A", s: "S" },
  { r: "K", s: "H" },
  { r: "Q", s: "D" },
  { r: "J", s: "C" },
  { r: "10", s: "S" },
];

export default function Home() {
  const router = useRouter();
  const [id, setId] = useState<Identity | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const i = getIdentity();
    setId(i);
    setName(i.name);
  }, []);

  const remember = () => {
    const n = name.trim() || "Player";
    const next = { ...id!, name: n };
    saveIdentity(next);
    return next;
  };

  const create = async () => {
    if (!id || busy) return;
    sfx.click();
    setBusy(true);
    setError(null);
    try {
      const me = remember();
      const { code } = await api<{ code: string }>("/api/rooms", { playerId: me.playerId, token: me.token, name: me.name });
      router.push(`/room/${code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!id || c.length !== 4 || busy) return;
    sfx.click();
    setBusy(true);
    setError(null);
    try {
      const me = remember();
      await api(`/api/rooms/${c}`, { type: "join", playerId: me.playerId, token: me.token, name: me.name });
      router.push(`/room/${c}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="home">
      <SwirlBackground mood="menu" />
      <div className="crt" aria-hidden />

      <div className="home-fan" aria-hidden>
        {FAN.map((c, i) => (
          <motion.div
            key={i}
            className="fan-card"
            initial={{ y: 400, rotate: 0, opacity: 0 }}
            animate={{ y: Math.abs(i - 2) * 14, rotate: (i - 2) * 12, opacity: 1 }}
            transition={{ delay: 0.15 + i * 0.09, type: "spring", stiffness: 160, damping: 15 }}
          >
            <div className="card-sway" style={{ animationDelay: `${-i * 0.6}s` }}>
              <div className="card-tilt static">
                <div className="card-front">
                  <CardFace r={c.r} s={c.s} />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.h1
        className="logo"
        initial={{ scale: 0.3, rotate: -10, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 11 }}
      >
        {"BLACKJAK".split("").map((ch, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.1}s` }}>
            {ch}
          </span>
        ))}
      </motion.h1>
      <p className="tagline">A blackjack party for up to 6 friends</p>

      <motion.div
        className="panel home-panel"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 18 }}
      >
        <label className="tiny" htmlFor="name">
          Your name
        </label>
        <input id="name" className="input" placeholder="Player" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />

        <button className="btn btn-orange btn-big" onClick={create} disabled={!id || busy}>
          Create table
        </button>

        <div className="or">or join with a code</div>
        <form className="join-row" onSubmit={join}>
          <input
            className="input code-input"
            placeholder="ABCD"
            value={code}
            maxLength={4}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
          />
          <button className="btn btn-blue" disabled={!id || busy || code.length !== 4}>
            Join
          </button>
        </form>
        {error && <div className="error">{error}</div>}
      </motion.div>
    </main>
  );
}

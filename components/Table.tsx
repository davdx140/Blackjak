"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { handTotal, isBlackjack } from "@/lib/cards";
import { getIdentity, Identity, saveIdentity, useRoom, useServerNow } from "@/lib/client";
import type { DealtCard, Hand, HandResult, PublicPlayer, PublicRoom } from "@/lib/game";
import { canDouble, canSplit, MIN_BET, TURN_TIME, BET_WINDOW } from "@/lib/game";
import { isMuted, setMuted, sfx } from "@/lib/sound";
import { Burst, CountUp, WavyText } from "./Juice";
import PlayingCard from "./PlayingCard";
import SwirlBackground, { Mood } from "./SwirlBackground";

const PLAYER_COLORS = ["#fe5f55", "#009dff", "#fda200", "#4bc292", "#c86bfa", "#ff8fc8"];
const CHIP_VALUES = [10, 25, 50, 100, 500];
const EMOJIS = ["🔥", "😱", "😂", "🃏", "💸", "👑"];
const MULT: Record<HandResult, string> = { blackjack: "2.5", win: "2", push: "1", lose: "0", bust: "0" };
const RESULT_LABEL: Record<HandResult, string> = {
  blackjack: "BLACKJACK!",
  win: "WIN",
  push: "PUSH",
  lose: "LOSE",
  bust: "BUST",
};

const visible = (cards: DealtCard[], now: number) => cards.filter((c) => c.at <= now);

function handLabel(cards: DealtCard[]) {
  if (cards.length === 0) return "No hand";
  if (isBlackjack(cards)) return "Blackjack";
  const { total, soft } = handTotal(cards);
  if (total > 21) return "Bust";
  return `${soft ? "Soft" : "Hard"} ${total}`;
}

export default function Table({ code }: { code: string }) {
  const [id, setId] = useState<Identity | null>(null);
  useEffect(() => setId(getIdentity()), []);
  const { room, error, storage, send, offset } = useRoom(code, id);
  const now = useServerNow(offset);
  const [toast, setToast] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [muted, setMutedState] = useState(false);
  useEffect(() => setMutedState(isMuted()), []);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  };
  const run = async (type: string, extra?: Record<string, unknown>) => {
    try {
      await send(type, extra);
    } catch (e) {
      flash((e as Error).message);
    }
  };

  if (!id || (!room && !error)) return <Loading />;
  if (!room) return <Missing error={error} />;

  const me = room.players.find((p) => p.id === id.playerId);
  if (!me) return <JoinGate room={room} id={id} onJoin={(name) => run("join", { name })} />;

  return (
    <TableView
      room={room}
      me={me}
      now={now}
      storage={storage}
      run={run}
      toast={toast}
      muted={muted}
      toggleMute={() => {
        setMuted(!muted);
        setMutedState(!muted);
      }}
      showRules={showRules}
      setShowRules={setShowRules}
    />
  );
}

function Loading() {
  return (
    <main className="center-screen">
      <SwirlBackground mood="felt" />
      <div className="panel pop-in">
        <WavyText text="Shuffling..." className="big-text" />
      </div>
    </main>
  );
}

function Missing({ error }: { error: string | null }) {
  return (
    <main className="center-screen">
      <SwirlBackground mood="lose" />
      <div className="panel pop-in stack">
        <h2 className="title-sm">Table not found</h2>
        <p className="muted">{error ?? "This table closed or never existed."}</p>
        <Link className="btn btn-orange" href="/">
          Back to lobby
        </Link>
      </div>
    </main>
  );
}

function JoinGate({ room, id, onJoin }: { room: PublicRoom; id: Identity; onJoin: (name: string) => void }) {
  const [name, setName] = useState(id.name);
  const full = room.players.length >= 6;
  return (
    <main className="center-screen">
      <SwirlBackground mood="menu" />
      <form
        className="panel pop-in stack join-gate"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim() || "Player";
          saveIdentity({ ...id, name: n });
          sfx.click();
          onJoin(n);
        }}
      >
        <div className="banner">Table {room.code}</div>
        <p className="muted">
          {room.players.length} / 6 seated{room.players.length ? `: ${room.players.map((p) => p.name).join(", ")}` : ""}
        </p>
        <input className="input" placeholder="Your name" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} autoFocus />
        <button className="btn btn-blue" disabled={full}>
          {full ? "Table full" : "Take a seat"}
        </button>
      </form>
    </main>
  );
}

interface ViewProps {
  room: PublicRoom;
  me: PublicPlayer;
  now: number;
  storage: string;
  run: (type: string, extra?: Record<string, unknown>) => Promise<void>;
  toast: string | null;
  muted: boolean;
  toggleMute: () => void;
  showRules: boolean;
  setShowRules: (v: boolean) => void;
}

function TableView({ room, me, now, storage, run, toast, muted, toggleMute, showRules, setShowRules }: ViewProps) {
  const others = room.players.filter((p) => p.id !== me.id);
  const dealerCards = visible(room.dealer, now);
  const dealerDoneAt = room.dealer.length ? Math.max(...room.dealer.map((c) => c.at)) : 0;
  const revealed = room.phase === "results" && now >= dealerDoneAt + 250;
  const myTurn = room.phase === "playing" && room.turn?.playerId === me.id;
  const myHand: Hand | undefined = me.hands[room.turn?.playerId === me.id ? room.turn.hand : me.active] ?? me.hands[0];
  const myNet = me.hands.reduce((s, h) => s + (h.net ?? 0), 0);
  const mood: Mood = revealed && me.hands.length ? (myNet > 0 ? "win" : myNet < 0 ? "lose" : "felt") : "felt";
  const ranked = [...room.players].sort((a, b) => b.chips - a.chips);

  // Sound + screen shake when results land for me.
  const [shake, setShake] = useState(false);
  const resultKey = `${room.round}-${revealed}`;
  const lastResult = useRef("");
  useEffect(() => {
    if (!revealed || lastResult.current === resultKey || !me.hands.length) return;
    lastResult.current = resultKey;
    const results = me.hands.map((h) => h.result);
    if (results.includes("blackjack")) sfx.blackjack();
    else if (myNet > 0) sfx.win();
    else if (myNet < 0) {
      sfx.lose();
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } else sfx.push();
  }, [revealed, resultKey, me.hands, myNet]);

  // A beep when it becomes my turn.
  const wasMyTurn = useRef(false);
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) sfx.click();
    wasMyTurn.current = myTurn;
  }, [myTurn]);

  const lastLog = room.log[room.log.length - 1];
  const showLog = lastLog && now - lastLog.t < 3500 ? lastLog : null;

  return (
    <main className={`table-root${shake ? " shake" : ""}`}>
      <SwirlBackground mood={mood} />
      <div className="crt" aria-hidden />

      <aside className="sidebar">
        <div className="side-head">
          <div className="banner">Table {room.code}</div>
          <div className="blind-row">
            <div className="blind-chip">
              <span>21</span>
            </div>
            <div className="dark-box">
              <div className="tiny">Blackjack pays</div>
              <div className="red-num">3 : 2</div>
              <div className="tiny">Dealer stands on 17</div>
            </div>
          </div>
        </div>

        <div className="dark-box row-box">
          <div className="tiny label-left">
            Your
            <br />
            bet
          </div>
          <div className="inner-box">
            <span className="chip-glyph">◆</span>
            <CountUp value={me.hands.reduce((s, h) => s + h.bet, 0) || me.bet} prefix="$" />
          </div>
        </div>

        <ScoreBox hand={myHand} revealed={revealed} now={now} />

        <div className="side-grid">
          <div className="side-buttons">
            <button className="btn btn-red btn-tall" onClick={() => setShowRules(true)}>
              Rules
            </button>
            <button className="btn btn-orange btn-tall" onClick={toggleMute}>
              {muted ? "Sound off" : "Sound on"}
            </button>
          </div>
          <div className="stat-grid">
            <div className="stat">
              <div className="tiny">Round</div>
              <div className="stat-num orange">{room.round || "-"}</div>
            </div>
            <div className="stat">
              <div className="tiny">Wins</div>
              <div className="stat-num blue">{me.wins}</div>
            </div>
            <div className="stat stat-wide">
              <CountUp value={me.chips} prefix="$" className="money" />
            </div>
            <div className="stat stat-wide">
              <div className="tiny">Shoe</div>
              <div className="shoe-bar">
                <div style={{ width: `${(room.shoeLeft / room.shoeSize) * 100}%` }} />
                <i style={{ left: `${(room.cutAt / room.shoeSize) * 100}%` }} title="Cut card" />
              </div>
            </div>
          </div>
        </div>

        <div className="dark-box leaderboard">
          <div className="tiny">Leaderboard</div>
          <ol>
            {ranked.map((p, i) => (
              <motion.li layout key={p.id} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
                <span className="rank">{i === 0 ? "👑" : i + 1}</span>
                <span className="lb-name" style={{ color: PLAYER_COLORS[p.color] }}>
                  {p.name}
                  {p.id === me.id ? " (you)" : ""}
                </span>
                <span className="lb-chips">${p.chips}</span>
              </motion.li>
            ))}
          </ol>
        </div>
        <Link href="/" className="btn btn-dark btn-small" onClick={() => run("leave")}>
          Leave table
        </Link>
      </aside>

      <section className="felt">
        <div className="mobile-hud">
          <span className="hud-code">{room.code}</span>
          <span className="hud-round">Round {room.round || "-"}</span>
          <CountUp value={me.chips} prefix="$" className="hud-money" />
          <button className="btn btn-red btn-small" onClick={() => setShowRules(true)}>
            Rules
          </button>
        </div>

        {storage === "unconfigured" && (
          <div className="warn">Multiplayer storage isn&apos;t configured. Add Upstash Redis in Vercel (see README).</div>
        )}

        <AnimatePresence>
          {showLog && (
            <motion.div
              key={showLog.id}
              className="ticker"
              initial={{ y: -40, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
            >
              {showLog.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dealer row, in the jokers' spot */}
        <div className="tray dealer-tray">
          <div className="tray-label">
            <span>Dealer</span>
            {dealerCards.length > 0 && <TotalBadge cards={dealerCards} />}
          </div>
          <div className="cards-row">
            {dealerCards.map((c, i) => (
              <PlayingCard key={c.id + i} r={c.r} s={c.s} index={i} />
            ))}
            {room.phase === "playing" && dealerCards.length === 1 && <div className="ghost-card">?</div>}
          </div>
        </div>

        {/* Other players */}
        <div className="seats">
          {others.length === 0 && room.phase !== "lobby" && <div className="muted solo">Playing solo. Share the code {room.code} to invite friends!</div>}
          {others.map((p) => (
            <Seat key={p.id} p={p} room={room} now={now} revealed={revealed} />
          ))}
        </div>

        {room.phase === "lobby" ? (
          <Lobby room={room} me={me} run={run} />
        ) : (
          <div className={`my-area${myTurn ? " my-turn" : ""}`}>
            <Reactions room={room} playerId={me.id} now={now} />
            <div className="my-hands">
              {me.hands.length === 0 && room.phase !== "betting" && <div className="muted">Sitting this one out</div>}
              {me.hands.map((h, i) => (
                <HandView
                  key={i}
                  hand={h}
                  now={now}
                  revealed={revealed}
                  active={myTurn && room.turn?.hand === i}
                  size="lg"
                  dim={me.hands.length > 1 && myTurn && room.turn?.hand !== i}
                />
              ))}
            </div>
            {myTurn && room.deadline && <TurnTimer deadline={room.deadline} now={now} />}
            <Controls room={room} me={me} now={now} run={run} myTurn={myTurn} />
          </div>
        )}

        <div className="emote-bar">
          {EMOJIS.map((e) => (
            <button key={e} className="emote" onClick={() => run("react", { emoji: e })}>
              {e}
            </button>
          ))}
        </div>

        <Shoe left={room.shoeLeft} size={room.shoeSize} />
      </section>

      <AnimatePresence>
        {toast && (
          <motion.div className="toast" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{showRules && <Rules onClose={() => setShowRules(false)} />}</AnimatePresence>
    </main>
  );
}

function ScoreBox({ hand, revealed, now }: { hand?: Hand; revealed: boolean; now: number }) {
  const cards = hand ? visible(hand.cards, now) : [];
  const result = revealed ? hand?.result : undefined;
  return (
    <div className="dark-box score-box">
      <div className="hand-name">
        {result ? RESULT_LABEL[result] : handLabel(cards)}
        {cards.length > 0 && <span className="lvl">{handTotal(cards).total}</span>}
      </div>
      <div className="chipmult">
        <div className="chips-box">
          <CountUp value={hand?.bet ?? 0} />
        </div>
        <span className="x">X</span>
        <div className="mult-box">
          <span key={result ?? "q"} className={result ? "juice" : ""}>
            {result ? MULT[result] : "?"}
          </span>
        </div>
      </div>
      {result && hand && (
        <div className={`net ${hand.net! >= 0 ? "pos" : "neg"}`}>
          {hand.net === 0 ? "even" : hand.net! > 0 ? `+$${hand.net}` : `-$${-hand.net!}`}
        </div>
      )}
    </div>
  );
}

function TotalBadge({ cards }: { cards: DealtCard[] }) {
  const { total, soft } = handTotal(cards);
  const bust = total > 21;
  return (
    <motion.span
      key={total}
      className={`total-badge${bust ? " bust" : ""}${isBlackjack(cards) ? " bj" : ""}`}
      initial={{ scale: 1.6, rotate: -8 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 14 }}
    >
      {isBlackjack(cards) ? "BJ" : soft && total < 21 ? `${total - 10}/${total}` : total}
    </motion.span>
  );
}

function HandView({
  hand,
  now,
  revealed,
  active,
  size,
  dim,
}: {
  hand: Hand;
  now: number;
  revealed: boolean;
  active?: boolean;
  size: "sm" | "md" | "lg";
  dim?: boolean;
}) {
  const cards = visible(hand.cards, now);
  const result = revealed ? hand.result : undefined;
  return (
    <div className={`hand hand-${size}${active ? " hand-active" : ""}`}>
      <div className="hand-top">
        {cards.length > 0 && <TotalBadge cards={cards} />}
        <span className="bet-tag">${hand.bet}</span>
        {hand.doubled && <span className="tag tag-orange">x2</span>}
      </div>
      <div className="cards-row">
        {cards.map((c, i) => (
          <PlayingCard key={c.id + i} r={c.r} s={c.s} index={i} size={size} dim={dim} sound={size !== "sm"} />
        ))}
      </div>
      <AnimatePresence>
        {result && (
          <motion.div
            className={`result result-${result}`}
            initial={{ scale: 0, rotate: -20, y: 10 }}
            animate={{ scale: 1, rotate: -6, y: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 12 }}
          >
            {RESULT_LABEL[result]}
            {hand.net !== 0 && <small>{hand.net! > 0 ? `+$${hand.net}` : `-$${-hand.net!}`}</small>}
          </motion.div>
        )}
      </AnimatePresence>
      {result === "blackjack" && <Burst />}
      {result === "win" && size === "lg" && <Burst count={14} gold={false} />}
    </div>
  );
}

function Seat({ p, room, now, revealed }: { p: PublicPlayer; room: PublicRoom; now: number; revealed: boolean }) {
  const turn = room.phase === "playing" && room.turn?.playerId === p.id;
  return (
    <motion.div
      layout
      className={`seat${turn ? " seat-turn" : ""}${p.away ? " seat-away" : ""}`}
      style={{ ["--pc" as string]: PLAYER_COLORS[p.color] }}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
    >
      <Reactions room={room} playerId={p.id} now={now} />
      <div className="seat-head">
        <span className="seat-name">{p.name}</span>
        <span className="seat-chips">${p.chips}</span>
      </div>
      <div className="seat-hands">
        {p.hands.length === 0 && (
          <div className="seat-status">
            {p.away
              ? "Away"
              : room.phase === "lobby"
                ? "Seated"
                : room.phase === "betting"
                  ? p.ready
                    ? `Bet $${p.bet} ✓`
                    : "Choosing bet..."
                  : "Sitting out"}
          </div>
        )}
        {p.hands.map((h, i) => (
          <HandView key={i} hand={h} now={now} revealed={revealed} active={turn && room.turn?.hand === i} size="sm" />
        ))}
      </div>
      {turn && room.deadline && <TurnTimer deadline={room.deadline} now={now} small />}
    </motion.div>
  );
}

function TurnTimer({ deadline, now, small }: { deadline: number; now: number; small?: boolean }) {
  const left = Math.max(0, deadline - now);
  const frac = Math.min(1, left / TURN_TIME);
  return (
    <div className={`timer${small ? " timer-sm" : ""}${left < 6000 ? " timer-hot" : ""}`}>
      <div style={{ width: `${frac * 100}%` }} />
    </div>
  );
}

function Controls({
  room,
  me,
  now,
  run,
  myTurn,
}: {
  room: PublicRoom;
  me: PublicPlayer;
  now: number;
  run: ViewProps["run"];
  myTurn: boolean;
}) {
  const [stake, setStake] = useState(me.bet || 50);
  const round = room.round;
  useEffect(() => {
    // Keep last round's bet as the default, trimmed to what's affordable.
    setStake((s) => Math.min(me.bet || s, me.chips));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);
  const [busy, setBusy] = useState(false);
  const go = async (type: string, extra?: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    sfx.click();
    await run(type, extra);
    setBusy(false);
  };

  if (room.phase === "betting") {
    const left = room.deadline ? Math.ceil(Math.max(0, room.deadline - now) / 1000) : null;
    if (me.ready) {
      return (
        <div className="controls">
          <div className="waiting">
            <WavyText text={`Bet locked: $${me.bet}`} />
            <div className="muted">
              Waiting for the table{left !== null ? `, dealing in ${left}s` : ""}
            </div>
          </div>
        </div>
      );
    }
    const add = (v: number) => {
      sfx.chip();
      setStake((s) => Math.min(me.chips, s + v));
    };
    return (
      <div className="controls bet-controls">
        <div className="chip-rack">
          {CHIP_VALUES.map((v) => (
            <button key={v} className={`poker-chip chip-${v}`} disabled={me.chips < v} onClick={() => add(v)}>
              <span>{v}</span>
            </button>
          ))}
        </div>
        <div className="bet-row">
          <button className="btn btn-dark" onClick={() => setStake(0)}>
            Clear
          </button>
          <div className="stake">
            <CountUp value={stake} prefix="$" />
          </div>
          <button className="btn btn-dark" onClick={() => setStake(me.chips)}>
            All in
          </button>
        </div>
        <button
          className="btn btn-blue btn-big"
          disabled={stake < MIN_BET || busy}
          onClick={async () => {
            await go("bet", { amount: stake });
            await run("confirm");
          }}
        >
          Deal me in
          {left !== null && <small> {left}s</small>}
        </button>
        {room.deadline && <div className="bet-timer" style={{ width: `${(Math.max(0, room.deadline - now) / BET_WINDOW) * 100}%` }} />}
      </div>
    );
  }

  if (room.phase === "playing") {
    if (!myTurn) {
      const who = room.players.find((p) => p.id === room.turn?.playerId);
      return (
        <div className="controls">
          <div className="waiting muted">{who ? `${who.name} is playing...` : "Dealing..."}</div>
        </div>
      );
    }
    const hand = me.hands[room.turn!.hand];
    const dealing = hand.cards.some((c) => c.at > now);
    return (
      <div className="controls action-row">
        <button className="btn btn-blue btn-action" disabled={busy || dealing} onClick={() => go("action", { action: "hit" })}>
          Hit
        </button>
        <button className="btn btn-red btn-action" disabled={busy || dealing} onClick={() => go("action", { action: "stand" })}>
          Stand
        </button>
        <button
          className="btn btn-orange btn-action"
          disabled={busy || dealing || !canDouble(hand, me)}
          onClick={() => go("action", { action: "double" })}
          title="Double on 9, 10 or 11"
        >
          Double
        </button>
        <button
          className="btn btn-green btn-action"
          disabled={busy || dealing || !canSplit(hand, me)}
          onClick={() => go("action", { action: "split" })}
        >
          Split
        </button>
      </div>
    );
  }

  return (
    <div className="controls">
      <div className="waiting muted">Next round in {Math.ceil(Math.max(0, (room.deadline ?? now) - now) / 1000)}s</div>
    </div>
  );
}

function Lobby({ room, me, run }: { room: PublicRoom; me: PublicPlayer; run: ViewProps["run"] }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? window.location.href : "";
  const host = room.hostId === me.id;
  return (
    <motion.div className="panel lobby pop-in" layout>
      <div className="banner">Waiting room</div>
      <div className="code-display">
        {[...room.code].map((ch, i) => (
          <motion.span
            key={i}
            initial={{ rotateX: 90, y: -20 }}
            animate={{ rotateX: 0, y: 0 }}
            transition={{ delay: i * 0.08, type: "spring", stiffness: 300, damping: 15 }}
          >
            {ch}
          </motion.span>
        ))}
      </div>
      <button
        className="btn btn-dark btn-small"
        onClick={() => {
          navigator.clipboard?.writeText(link);
          setCopied(true);
          sfx.chip();
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Link copied!" : "Copy invite link"}
      </button>
      <ul className="lobby-list">
        <AnimatePresence>
          {room.players.map((p) => (
            <motion.li
              key={p.id}
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              style={{ ["--pc" as string]: PLAYER_COLORS[p.color] }}
            >
              <i />
              {p.name}
              {p.id === room.hostId && <span className="tag tag-orange">host</span>}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {host ? (
        <button className="btn btn-blue btn-big" onClick={() => run("start")}>
          Start game
        </button>
      ) : (
        <div className="muted">
          <WavyText text="Waiting for the host to start..." />
        </div>
      )}
    </motion.div>
  );
}

function Reactions({ room, playerId, now }: { room: PublicRoom; playerId: string; now: number }) {
  const mine = useMemo(() => room.reactions.filter((r) => r.playerId === playerId), [room.reactions, playerId]);
  return (
    <div className="reactions" aria-hidden>
      {mine
        .filter((r) => now - r.t < 2600)
        .map((r) => (
          <span key={r.id} className="float-emoji" style={{ left: `${30 + ((r.t / 7) % 40)}%` }}>
            {r.emoji}
          </span>
        ))}
    </div>
  );
}

function Shoe({ left, size }: { left: number; size: number }) {
  return (
    <div className="shoe-wrap">
      <div className="shoe" id="shoe">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="shoe-card" style={{ transform: `translate(${-i * 2}px, ${-i * 2}px)` }}>
            <div className="card-back">
              <div className="card-back-inner">
                <span>♠</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="shoe-count">
        {left}/{size}
      </div>
    </div>
  );
}

function Rules({ onClose }: { onClose: () => void }) {
  return (
    <motion.div className="modal-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="panel rules"
        initial={{ y: 80, scale: 0.8, rotate: -3 }}
        animate={{ y: 0, scale: 1, rotate: 0 }}
        exit={{ y: 80, scale: 0.8 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="banner">House rules</div>
        <ul>
          <li>Six 52-card decks in the shoe. A cut card triggers a reshuffle.</li>
          <li>Get closer to 21 than the dealer without going over.</li>
          <li>Aces count 1 or 11. Faces count 10. Everything else is face value.</li>
          <li>European style: the dealer takes one card, and the second only after everyone has played.</li>
          <li>The dealer must draw to 16 and stands on every 17.</li>
          <li>Blackjack (ace + ten-card) pays 3:2. Other wins pay 1:1. Ties push.</li>
          <li>Double down on 9, 10 or 11 for exactly one more card.</li>
          <li>Split a pair once. Split aces get one card each.</li>
          <li>A dealer blackjack beats every hand except a player blackjack.</li>
          <li>Broke? The house bails you out with $500 so the party keeps going.</li>
        </ul>
        <button className="btn btn-orange" onClick={onClose}>
          Got it
        </button>
      </motion.div>
    </motion.div>
  );
}

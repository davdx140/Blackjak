import { buildShoe, Card, handTotal, isBlackjack, isBust, cardValue, DECKS, PENETRATION } from "./cards";

/**
 * Authoritative game logic. Everything here is pure data in / data out so it
 * can run inside any serverless function: the room is loaded from storage,
 * mutated by one of these functions, and saved back.
 *
 * Rules follow the European ("no hole card") casino game as played at the
 * Spielbanken Bayern: 6 x 52-card shoe, dealer takes a single card until all
 * players are done, dealer stands on 17, blackjack pays 3:2, double down on
 * 9/10/11, split once per pair (split aces get one card each).
 */

export type Phase = "lobby" | "betting" | "playing" | "results";

export interface DealtCard extends Card {
  /** Server time (ms) at which the card becomes visible; drives deal animation. */
  at: number;
}

export type HandResult = "blackjack" | "win" | "push" | "lose" | "bust";

export interface Hand {
  cards: DealtCard[];
  bet: number;
  doubled: boolean;
  done: boolean;
  fromSplit: boolean;
  result?: HandResult;
  /** Net chips won (+) or lost (-) on this hand. */
  net?: number;
}

export interface Player {
  id: string;
  token: string;
  name: string;
  color: number;
  chips: number;
  /** Bet staged for the next round. */
  bet: number;
  ready: boolean;
  hands: Hand[];
  active: number;
  lastSeen: number;
  wins: number;
  blackjacks: number;
  /** Increments every time the player is bailed out at 0 chips. */
  bailouts: number;
}

export interface Reaction {
  id: string;
  playerId: string;
  emoji: string;
  t: number;
}

export interface Room {
  code: string;
  hostId: string;
  phase: Phase;
  round: number;
  players: Player[];
  dealer: DealtCard[];
  shoe: Card[];
  shoeSize: number;
  turn: { playerId: string; hand: number } | null;
  deadline: number | null;
  reactions: Reaction[];
  /** Short feed of things that happened, for the toast ticker. */
  log: { id: number; t: number; text: string }[];
  logSeq: number;
  version: number;
  createdAt: number;
}

export const MAX_PLAYERS = 6;
export const START_CHIPS = 1000;
export const BAILOUT_CHIPS = 500;
export const MIN_BET = 10;
export const DEAL_STEP = 380;
export const BET_WINDOW = 15_000;
export const TURN_TIME = 25_000;
export const RESULTS_TIME = 6_000;
export const IDLE_KICK = 20_000;

export class GameError extends Error {}

export function createRoom(code: string, now: number): Room {
  const shoe = buildShoe(DECKS);
  return {
    code,
    hostId: "",
    phase: "lobby",
    round: 0,
    players: [],
    dealer: [],
    shoe,
    shoeSize: shoe.length,
    turn: null,
    deadline: null,
    reactions: [],
    log: [],
    logSeq: 0,
    version: 0,
    createdAt: now,
  };
}

function log(room: Room, text: string, now: number) {
  room.log.push({ id: ++room.logSeq, t: now, text });
  if (room.log.length > 12) room.log.splice(0, room.log.length - 12);
}

export function addPlayer(room: Room, p: { id: string; token: string; name: string }, now: number): Player {
  const existing = room.players.find((x) => x.id === p.id);
  if (existing) {
    if (existing.token !== p.token) throw new GameError("That seat belongs to someone else");
    existing.name = p.name || existing.name;
    existing.lastSeen = now;
    return existing;
  }
  if (room.players.length >= MAX_PLAYERS) throw new GameError("Table is full");
  const used = new Set(room.players.map((x) => x.color));
  let color = 0;
  while (used.has(color)) color++;
  const player: Player = {
    id: p.id,
    token: p.token,
    name: p.name.slice(0, 16) || "Player",
    color,
    chips: START_CHIPS,
    bet: 0,
    ready: false,
    hands: [],
    active: 0,
    lastSeen: now,
    wins: 0,
    blackjacks: 0,
    bailouts: 0,
  };
  room.players.push(player);
  if (!room.hostId) room.hostId = player.id;
  log(room, `${player.name} joined the table`, now);
  return player;
}

export function removePlayer(room: Room, id: string, now: number) {
  const i = room.players.findIndex((p) => p.id === id);
  if (i < 0) return;
  const [p] = room.players.splice(i, 1);
  log(room, `${p.name} left`, now);
  if (room.hostId === id) room.hostId = room.players[0]?.id ?? "";
  if (room.turn?.playerId === id) advanceTurn(room, now);
  if (room.phase === "betting") maybeDeal(room, now);
}

function draw(room: Room, at: number): DealtCard {
  if (room.shoe.length === 0) {
    room.shoe = buildShoe(DECKS);
    room.shoeSize = room.shoe.length;
  }
  const c = room.shoe.pop()!;
  return { ...c, at };
}

export function startGame(room: Room, playerId: string, now: number) {
  if (room.phase !== "lobby") throw new GameError("Game already running");
  if (playerId !== room.hostId) throw new GameError("Only the host can start");
  room.phase = "betting";
  room.round = 1;
  room.deadline = null;
  log(room, "Place your bets!", now);
}

export function placeBet(room: Room, player: Player, amount: number, now: number) {
  if (room.phase !== "betting") throw new GameError("Betting is closed");
  if (!Number.isFinite(amount) || amount < 0) throw new GameError("Bad bet");
  amount = Math.floor(amount);
  if (amount > player.chips) throw new GameError("Not enough chips");
  player.bet = amount;
  player.ready = false;
}

export function confirmBet(room: Room, player: Player, now: number) {
  if (room.phase !== "betting") throw new GameError("Betting is closed");
  if (player.bet < MIN_BET) throw new GameError(`Minimum bet is ${MIN_BET}`);
  if (player.bet > player.chips) throw new GameError("Not enough chips");
  player.ready = true;
  // The first confirmed bet starts the countdown for everyone else.
  if (room.deadline === null) room.deadline = now + BET_WINDOW;
  maybeDeal(room, now);
}

function maybeDeal(room: Room, now: number) {
  if (room.phase !== "betting") return;
  const ready = room.players.filter((p) => p.ready);
  if (ready.length === 0) {
    room.deadline = null;
    return;
  }
  const allIn = room.players.every((p) => p.ready || now - p.lastSeen > IDLE_KICK);
  if (allIn || (room.deadline !== null && now >= room.deadline)) deal(room, now);
}

function deal(room: Room, now: number) {
  // Cut card reached: reshuffle before the round starts.
  if (room.shoe.length < room.shoeSize * (1 - PENETRATION)) {
    room.shoe = buildShoe(DECKS);
    room.shoeSize = room.shoe.length;
    log(room, "Cut card! Shuffling a fresh shoe", now);
  }
  const playing = room.players.filter((p) => p.ready && p.bet >= MIN_BET && p.bet <= p.chips);
  for (const p of room.players) {
    p.hands = [];
    p.active = 0;
  }
  room.dealer = [];
  let at = now + 250;
  for (const p of playing) {
    p.chips -= p.bet;
    p.hands = [{ cards: [draw(room, at)], bet: p.bet, doubled: false, done: false, fromSplit: false }];
    at += DEAL_STEP;
  }
  room.dealer.push(draw(room, at));
  at += DEAL_STEP;
  for (const p of playing) {
    p.hands[0].cards.push(draw(room, at));
    at += DEAL_STEP;
    if (isBlackjack(p.hands[0].cards)) p.hands[0].done = true;
  }
  for (const p of room.players) p.ready = false;
  room.phase = "playing";
  room.turn = null;
  room.deadline = null;
  // First turn starts once the deal animation is over.
  advanceTurn(room, at);
}

function currentHand(room: Room): { player: Player; hand: Hand } | null {
  if (!room.turn) return null;
  const player = room.players.find((p) => p.id === room.turn!.playerId);
  if (!player) return null;
  const hand = player.hands[room.turn.hand];
  return hand ? { player, hand } : null;
}

/** Move the turn to the next unfinished hand, or let the dealer play. */
function advanceTurn(room: Room, now: number) {
  for (const p of room.players) {
    for (let h = 0; h < p.hands.length; h++) {
      if (!p.hands[h].done) {
        room.turn = { playerId: p.id, hand: h };
        p.active = h;
        room.deadline = now + TURN_TIME;
        return;
      }
    }
  }
  room.turn = null;
  dealerPlay(room, now);
}

export type Action = "hit" | "stand" | "double" | "split";

export function canDouble(hand: Hand, player: Pick<Player, "chips">) {
  const t = handTotal(hand.cards).total;
  return hand.cards.length === 2 && !hand.doubled && t >= 9 && t <= 11 && player.chips >= hand.bet;
}

export function canSplit(hand: Hand, player: Pick<Player, "chips" | "hands">) {
  return (
    hand.cards.length === 2 &&
    !hand.fromSplit &&
    player.hands.length < 2 &&
    cardValue(hand.cards[0].r) === cardValue(hand.cards[1].r) &&
    player.chips >= hand.bet
  );
}

export function act(room: Room, player: Player, action: Action, now: number) {
  if (room.phase !== "playing") throw new GameError("Not playing right now");
  const cur = currentHand(room);
  if (!cur || cur.player.id !== player.id) throw new GameError("Not your turn");
  const { hand } = cur;
  // Cards still flying in from the deal can't be acted on yet.
  const lastAt = Math.max(...hand.cards.map((c) => c.at));
  const t = Math.max(now, lastAt);

  switch (action) {
    case "hit": {
      hand.cards.push(draw(room, t));
      const { total } = handTotal(hand.cards);
      if (total >= 21) hand.done = true;
      break;
    }
    case "stand":
      hand.done = true;
      break;
    case "double": {
      if (!canDouble(hand, player)) throw new GameError("Can only double on 9, 10 or 11");
      player.chips -= hand.bet;
      hand.bet *= 2;
      hand.doubled = true;
      hand.cards.push(draw(room, t));
      hand.done = true;
      log(room, `${player.name} doubles down!`, now);
      break;
    }
    case "split": {
      if (!canSplit(hand, player)) throw new GameError("Can't split this hand");
      player.chips -= hand.bet;
      const second = hand.cards.pop()!;
      const aces = hand.cards[0].r === "A";
      hand.fromSplit = true;
      hand.cards.push(draw(room, t + DEAL_STEP));
      const other: Hand = {
        cards: [{ ...second, at: t }, draw(room, t + DEAL_STEP * 2)],
        bet: hand.bet,
        doubled: false,
        done: false,
        fromSplit: true,
      };
      player.hands.push(other);
      // Split aces receive exactly one card each.
      if (aces) {
        hand.done = true;
        other.done = true;
      }
      for (const h of player.hands) if (handTotal(h.cards).total === 21) h.done = true;
      log(room, `${player.name} splits!`, now);
      advanceTurn(room, t + DEAL_STEP * 2);
      return;
    }
    default:
      throw new GameError("Unknown action");
  }
  if (hand.done) advanceTurn(room, Math.max(...hand.cards.map((c) => c.at)));
  else room.deadline = Math.max(...hand.cards.map((c) => c.at)) + TURN_TIME;
}

function dealerPlay(room: Room, now: number) {
  let at = Math.max(now, ...room.dealer.map((c) => c.at)) + 600;
  const live = room.players.some((p) => p.hands.some((h) => !isBust(h.cards)));
  room.dealer.push(draw(room, at));
  if (live) {
    // Dealer draws to 17 and stands on any 17, soft or hard.
    while (handTotal(room.dealer).total < 17) {
      at += 750;
      room.dealer.push(draw(room, at));
    }
  }
  settle(room, at);
  room.phase = "results";
  room.deadline = at + RESULTS_TIME;
}

export function settleHand(hand: Hand, dealer: Card[]): { result: HandResult; payout: number } {
  const p = handTotal(hand.cards).total;
  const d = handTotal(dealer).total;
  const playerBJ = !hand.fromSplit && isBlackjack(hand.cards);
  const dealerBJ = isBlackjack(dealer);
  if (p > 21) return { result: "bust", payout: 0 };
  if (playerBJ && dealerBJ) return { result: "push", payout: hand.bet };
  if (playerBJ) return { result: "blackjack", payout: hand.bet + Math.floor(hand.bet * 1.5) };
  // No hole card: a dealer blackjack takes every other hand, doubles and splits included.
  if (dealerBJ) return { result: "lose", payout: 0 };
  if (d > 21 || p > d) return { result: "win", payout: hand.bet * 2 };
  if (p === d) return { result: "push", payout: hand.bet };
  return { result: "lose", payout: 0 };
}

function settle(room: Room, now: number) {
  for (const p of room.players) {
    for (const h of p.hands) {
      const { result, payout } = settleHand(h, room.dealer);
      h.result = result;
      h.net = payout - h.bet;
      p.chips += payout;
      if (result === "win" || result === "blackjack") p.wins++;
      if (result === "blackjack") p.blackjacks++;
    }
  }
  const d = handTotal(room.dealer).total;
  log(room, d > 21 ? `Dealer busts with ${d}!` : `Dealer stands on ${d}`, now);
}

function nextRound(room: Room, now: number) {
  room.round++;
  room.phase = "betting";
  room.turn = null;
  room.deadline = null;
  room.dealer = [];
  for (const p of room.players) {
    p.hands = [];
    p.ready = false;
    if (p.bet > p.chips) p.bet = Math.max(0, Math.min(p.chips, p.bet));
    if (p.chips < MIN_BET) {
      p.chips += BAILOUT_CHIPS;
      p.bailouts++;
      log(room, `${p.name} got bailed out with $${BAILOUT_CHIPS}`, now);
    }
  }
}

/**
 * Advance timers. Called on every read so the game moves forward without a
 * long-running server: whoever polls first after a deadline pushes it along.
 * Returns true if the room changed.
 */
export function tick(room: Room, now: number): boolean {
  const before = room.version;
  const bump = () => (room.version = before + 1);
  // Drop players who closed the tab long ago.
  const gone = room.players.filter((p) => now - p.lastSeen > 5 * 60_000);
  for (const p of gone) {
    removePlayer(room, p.id, now);
    bump();
  }
  room.reactions = room.reactions.filter((r) => now - r.t < 6000);

  if (room.phase === "betting") {
    if (room.deadline !== null && now >= room.deadline) {
      maybeDeal(room, now);
      bump();
    }
  } else if (room.phase === "playing") {
    const cur = currentHand(room);
    if (!cur) {
      advanceTurn(room, now);
      bump();
    } else if (room.deadline !== null && (now >= room.deadline || now - cur.player.lastSeen > IDLE_KICK)) {
      cur.hand.done = true;
      log(room, `${cur.player.name} ran out of time`, now);
      advanceTurn(room, now);
      bump();
    }
  } else if (room.phase === "results") {
    if (room.deadline !== null && now >= room.deadline) {
      nextRound(room, now);
      bump();
    }
  }
  return room.version !== before;
}

export function react(room: Room, player: Player, emoji: string, now: number) {
  const allowed = ["🔥", "😱", "😂", "🃏", "💸", "👑"];
  if (!allowed.includes(emoji)) throw new GameError("Unknown emoji");
  room.reactions.push({ id: `${now}-${player.id}`, playerId: player.id, emoji, t: now });
  if (room.reactions.length > 20) room.reactions.shift();
}

/** What clients get to see: no shoe order, no tokens, no undealt cards. */
export function publicView(room: Room, now: number) {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    round: room.round,
    now,
    deadline: room.deadline,
    turn: room.turn,
    shoeLeft: room.shoe.length,
    shoeSize: room.shoeSize,
    cutAt: Math.floor(room.shoeSize * (1 - PENETRATION)),
    dealer: room.dealer,
    reactions: room.reactions,
    log: room.log,
    version: room.version,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      chips: p.chips,
      bet: p.bet,
      ready: p.ready,
      hands: p.hands,
      active: p.active,
      wins: p.wins,
      blackjacks: p.blackjacks,
      bailouts: p.bailouts,
      away: now - p.lastSeen > IDLE_KICK,
    })),
  };
}

export type PublicRoom = ReturnType<typeof publicView>;
export type PublicPlayer = PublicRoom["players"][number];

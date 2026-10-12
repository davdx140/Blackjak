import { describe, expect, it } from "vitest";
import { handTotal, isBlackjack, buildShoe, type Card, type Rank } from "../lib/cards";
import {
  act,
  addPlayer,
  confirmBet,
  createRoom,
  placeBet,
  publicView,
  settleHand,
  startGame,
  tick,
  type Hand,
  type Room,
} from "../lib/game";

const c = (r: Rank, s: Card["s"] = "S") => ({ id: r + s + Math.random(), r, s, at: 0 });

describe("hand totals", () => {
  it("counts aces as 11 or 1", () => {
    expect(handTotal([c("A"), c("6")])).toEqual({ total: 17, soft: true });
    expect(handTotal([c("A"), c("6"), c("9")])).toEqual({ total: 16, soft: false });
    expect(handTotal([c("A"), c("A"), c("9")])).toEqual({ total: 21, soft: true });
    expect(handTotal([c("K"), c("Q"), c("2")]).total).toBe(22);
  });
  it("detects blackjack", () => {
    expect(isBlackjack([c("A"), c("K")])).toBe(true);
    expect(isBlackjack([c("A"), c("5"), c("5")])).toBe(false);
  });
  it("builds a six-deck shoe", () => {
    expect(buildShoe().length).toBe(312);
  });
});

const hand = (cards: ReturnType<typeof c>[], extra: Partial<Hand> = {}): Hand => ({
  cards,
  bet: 100,
  doubled: false,
  done: true,
  fromSplit: false,
  ...extra,
});

describe("settlement", () => {
  it("pays blackjack 3:2", () => {
    expect(settleHand(hand([c("A"), c("K")]), [c("9"), c("8")])).toEqual({ result: "blackjack", payout: 250 });
  });
  it("pushes blackjack vs blackjack", () => {
    expect(settleHand(hand([c("A"), c("K")]), [c("A"), c("Q")]).result).toBe("push");
  });
  it("dealer blackjack beats 21 made of three cards", () => {
    expect(settleHand(hand([c("7"), c("7"), c("7")]), [c("A"), c("Q")]).result).toBe("lose");
  });
  it("split 21 is not blackjack", () => {
    expect(settleHand(hand([c("A"), c("K")], { fromSplit: true }), [c("10"), c("Q")])).toEqual({ result: "win", payout: 200 });
  });
  it("busts lose even if dealer busts", () => {
    expect(settleHand(hand([c("K"), c("Q"), c("5")]), [c("K"), c("6"), c("9")]).result).toBe("bust");
  });
  it("wins when the dealer busts", () => {
    expect(settleHand(hand([c("K"), c("2")]), [c("K"), c("6"), c("9")]).result).toBe("win");
  });
});

function stack(room: Room, ranks: Rank[]) {
  // draw() pops from the end, so reverse to deal in the listed order.
  room.shoe = ranks.map((r, i) => ({ id: `t${i}`, r, s: "H" as const })).reverse().concat([]);
  room.shoe = [...Array.from({ length: 300 }, (_, i) => ({ id: `f${i}`, r: "2" as Rank, s: "C" as const })), ...room.shoe];
}

describe("a full round", () => {
  it("deals European style, plays turns and settles", () => {
    let now = 1_000_000;
    const room = createRoom("TEST", now);
    const a = addPlayer(room, { id: "a", token: "ta", name: "Ann" }, now);
    const b = addPlayer(room, { id: "b", token: "tb", name: "Bob" }, now);
    startGame(room, "a", now);
    // Ann: 10, 6   Bob: 9, 2   Dealer: 7 ... then Bob doubles (gets K), dealer draws 10 => 17
    stack(room, ["10", "9", "7", "6", "2", "K", "10"]);
    placeBet(room, a, 100, now);
    placeBet(room, b, 50, now);
    confirmBet(room, a, now);
    expect(room.phase).toBe("betting");
    confirmBet(room, b, now);
    expect(room.phase).toBe("playing");
    expect(room.dealer.length).toBe(1);
    expect(a.chips).toBe(900);
    expect(room.turn).toEqual({ playerId: "a", hand: 0 });

    now += 3000;
    expect(() => act(room, b, "hit", now)).toThrow("Not your turn");
    act(room, a, "stand", now);
    expect(room.turn?.playerId).toBe("b");
    act(room, b, "double", now);
    expect(b.hands[0].bet).toBe(100);
    expect(room.phase).toBe("results");
    expect(handTotal(room.dealer).total).toBe(17);
    expect(a.hands[0].result).toBe("lose");
    expect(b.hands[0].result).toBe("win");
    expect(a.chips).toBe(900);
    expect(b.chips).toBe(1100);

    // Results time out into the next betting round.
    now = room.deadline! + 1;
    expect(tick(room, now)).toBe(true);
    expect(room.phase).toBe("betting");
    expect(room.round).toBe(2);
  });

  it("auto-stands a player whose turn timer expires", () => {
    let now = 5_000;
    const room = createRoom("TIME", now);
    const a = addPlayer(room, { id: "a", token: "ta", name: "Ann" }, now);
    startGame(room, "a", now);
    stack(room, ["10", "7", "8", "10"]);
    placeBet(room, a, 10, now);
    confirmBet(room, a, now);
    expect(room.phase).toBe("playing");
    now = room.deadline! + 1;
    a.lastSeen = now;
    tick(room, now);
    expect(room.phase).toBe("results");
    expect(a.hands[0].result).toBe("win"); // 18 vs dealer 17
  });

  it("never leaks tokens or the shoe", () => {
    const room = createRoom("LEAK", 0);
    addPlayer(room, { id: "a", token: "secret", name: "Ann" }, 0);
    const json = JSON.stringify(publicView(room, 0));
    expect(json).not.toContain("secret");
    expect(json).not.toContain('"shoe"');
  });

  it("only lets the host start", () => {
    const room = createRoom("HOST", 0);
    addPlayer(room, { id: "a", token: "ta", name: "Ann" }, 0);
    addPlayer(room, { id: "b", token: "tb", name: "Bob" }, 0);
    expect(() => startGame(room, "b", 0)).toThrow();
  });

  it("splits a pair into two hands", () => {
    let now = 0;
    const room = createRoom("SPLT", now);
    const a = addPlayer(room, { id: "a", token: "ta", name: "Ann" }, now);
    startGame(room, "a", now);
    stack(room, ["8", "6", "8", "3", "K", "10", "9"]);
    placeBet(room, a, 100, now);
    confirmBet(room, a, now);
    now += 5000;
    act(room, a, "split", now);
    expect(a.hands.length).toBe(2);
    expect(a.chips).toBe(800);
    expect(a.hands.map((h) => handTotal(h.cards).total)).toEqual([11, 18]);
  });
});

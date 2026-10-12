export type Suit = "S" | "H" | "D" | "C";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  id: string;
  r: Rank;
  s: Suit;
}

export const SUITS: Suit[] = ["S", "H", "D", "C"];
export const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

/** Number of 52-card decks in the shoe. */
export const DECKS = 6;
/** Fraction of the shoe dealt before the cut card forces a reshuffle. */
export const PENETRATION = 0.75;

export function buildShoe(decks = DECKS, rand: () => number = Math.random): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const s of SUITS) {
      for (const r of RANKS) shoe.push({ id: `${d}${s}${r}`, r, s });
    }
  }
  // Fisher-Yates
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

export function cardValue(r: Rank): number {
  if (r === "A") return 1;
  if (r === "J" || r === "Q" || r === "K") return 10;
  return Number(r);
}

/** Best total for a hand: aces count 11 unless that would bust, then 1. */
export function handTotal(cards: Pick<Card, "r">[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c.r);
    if (c.r === "A") aces++;
  }
  const soft = aces > 0 && total + 10 <= 21;
  return { total: soft ? total + 10 : total, soft };
}

export function isBlackjack(cards: Pick<Card, "r">[]): boolean {
  return cards.length === 2 && handTotal(cards).total === 21;
}

export function isBust(cards: Pick<Card, "r">[]): boolean {
  return handTotal(cards).total > 21;
}

export const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
export const isRed = (s: Suit) => s === "H" || s === "D";

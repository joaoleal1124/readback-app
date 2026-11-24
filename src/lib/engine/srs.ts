/**
 * Spaced repetition of mistakes (Leitner boxes). A step you get wrong goes to box 1
 * and is due again straight away; every right answer moves it up a box and pushes
 * the next review further out. After box 5 the step is learnt and leaves the deck.
 */

export const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16];
export const LAST_BOX = 5;

export interface Card {
  box: number;
  /** Day the card is due, as YYYY-MM-DD in the student's time zone. */
  due: string;
  lapses: number;
}

export type Deck = Record<string, Card>;

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

/** A wrong answer: back to box 1, due today. */
export function recordMistake(deck: Deck, stepId: string, today: string): Deck {
  const old = deck[stepId];
  return { ...deck, [stepId]: { box: 1, due: today, lapses: (old?.lapses ?? 0) + 1 } };
}

/** The result of reviewing a card: right first time moves it up, otherwise it starts again tomorrow. */
export function recordReview(deck: Deck, stepId: string, rightFirstTime: boolean, today: string): Deck {
  const old = deck[stepId];
  if (!old) return deck;
  const next = { ...deck };
  if (!rightFirstTime) {
    next[stepId] = { box: 1, due: addDays(today, 1), lapses: old.lapses + 1 };
    return next;
  }
  const box = old.box + 1;
  if (box > LAST_BOX) delete next[stepId];
  else next[stepId] = { ...old, box, due: addDays(today, INTERVAL_DAYS[box]) };
  return next;
}

/** Due cards, the most forgotten first. */
export function dueCards(deck: Deck, today: string, limit = 15): string[] {
  return Object.entries(deck)
    .filter(([, c]) => c.due <= today)
    .sort((a, b) => a[1].box - b[1].box || b[1].lapses - a[1].lapses || a[1].due.localeCompare(b[1].due))
    .slice(0, limit)
    .map(([id]) => id);
}

const KEY = "readback-srs-v1";

export function loadDeck(): Deck {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Deck;
  } catch {
    return {};
  }
}

export function saveDeck(deck: Deck): Deck {
  try {
    localStorage.setItem(KEY, JSON.stringify(deck));
  } catch {}
  return deck;
}

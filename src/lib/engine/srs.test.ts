import { describe, expect, it } from "vitest";
import { addDays, dueCards, recordMistake, recordReview, type Deck } from "./srs";

const D = "2026-11-24";

describe("spaced repetition", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 16)).toBe("2027-01-16");
  });

  it("puts a mistake in box 1, due today", () => {
    const deck = recordMistake({}, "a", D);
    expect(deck.a).toEqual({ box: 1, due: D, lapses: 1 });
    expect(dueCards(deck, D)).toEqual(["a"]);
  });

  it("spaces the reviews out and retires learnt steps", () => {
    let deck: Deck = recordMistake({}, "a", D);
    let day = D;
    const gaps: number[] = [];
    for (let i = 0; i < 5; i++) {
      deck = recordReview(deck, "a", true, day);
      if (!deck.a) break;
      const next = deck.a.due;
      gaps.push((new Date(next).getTime() - new Date(day).getTime()) / 86_400_000);
      day = next;
    }
    expect(gaps).toEqual([2, 4, 8, 16]);
    expect(deck.a).toBeUndefined();
  });

  it("sends a missed review back to the start, due tomorrow", () => {
    let deck = recordMistake({}, "a", D);
    deck = recordReview(deck, "a", true, D);
    deck = recordReview(deck, "a", false, deck.a.due);
    expect(deck.a.box).toBe(1);
    expect(deck.a.lapses).toBe(2);
    expect(dueCards(deck, D)).toEqual([]);
  });

  it("shows the most forgotten steps first", () => {
    let deck: Deck = {
      x: { box: 3, due: D, lapses: 1 },
      y: { box: 1, due: D, lapses: 1 },
      z: { box: 1, due: D, lapses: 4 },
      later: { box: 1, due: addDays(D, 1), lapses: 9 },
    };
    expect(dueCards(deck, D)).toEqual(["z", "y", "x"]);
    deck = recordReview(deck, "unknown", true, D);
    expect(Object.keys(deck)).toHaveLength(4);
  });
});

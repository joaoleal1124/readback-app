import { describe, expect, it } from "vitest";
import { checkSpoken, makeItem, makeSession, sayAltitude, type DrillKind } from "./phonetic";

const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length];
};

describe("phonetic drills", () => {
  it("says altitudes the ICAO way", () => {
    expect(sayAltitude(3500)).toBe("tree thousand fife hundred feet");
    expect(sayAltitude(12500)).toBe("one two thousand fife hundred feet");
    expect(sayAltitude(1000)).toBe("one thousand feet");
  });

  it("accepts everyday spellings of the radio words", () => {
    expect(checkSpoken("Charlie Sierra Alpha Yankee Bravo", "Charlie Sierra Alfa Yankee Bravo").ok).toBe(true);
    expect(checkSpoken("one one eight point seven five", "one one eight decimal seven fife").ok).toBe(true);
    expect(checkSpoken("xray juliet", "X-ray Juliett").ok).toBe(true);
    expect(checkSpoken("two seven zero", "heading two seven zero").ok).toBe(true);
  });

  it("refuses figures and wrong order, and says why", () => {
    const r = checkSpoken("118.75", "one one eight decimal seven fife");
    expect(r).toEqual({ ok: false, usedFigures: true });
    expect(checkSpoken("CS AYB", "Charlie Sierra Alfa Yankee Bravo").usedFigures).toBe(true);
    expect(checkSpoken("Charlie Sierra Bravo Yankee Alfa", "Charlie Sierra Alfa Yankee Bravo").ok).toBe(false);
    expect(checkSpoken("tree thousand", "tree thousand fife hundred feet").ok).toBe(false);
  });

  it("builds registrations of the right shape", () => {
    expect(makeItem("reg", seq(0, 0.1, 0.2, 0.3)).prompt).toMatch(/^CS-[A-Z]{3}$/);
    const us = makeItem("reg", seq(5 / 12, 0.5, 0.1, 0.2));
    expect(us.prompt).toMatch(/^N\d{3}[A-Z]{2}$/);
  });

  it("gives every generated item an answer that passes its own check", () => {
    const kinds: DrillKind[] = ["reg", "freq", "heading", "altitude", "level", "squawk"];
    for (let i = 0; i < 300; i++) {
      const item = makeItem(kinds[i % kinds.length]);
      expect(checkSpoken(item.spoken, item.spoken).ok, item.prompt).toBe(true);
      expect(checkSpoken(item.prompt, item.spoken).ok, item.prompt).toBe(false);
    }
  });

  it("offers four different options including the right one", () => {
    for (const k of ["letter", "hear"] as const) {
      const item = makeItem(k);
      expect(new Set(item.options).size).toBe(4);
      expect(item.options).toContain(item.spoken);
    }
    expect(makeSession()).toHaveLength(12);
  });
});

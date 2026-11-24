import { describe, expect, it } from "vitest";
import sims from "@/server/content/sims.json";
import { EMPTY_STATS, bestStreak, record, streak, unlocked, type Stats } from "./achievements";
import type { Simulation } from "./types";

const SIMS = sims as Simulation[];

describe("streak", () => {
  it("counts consecutive days up to today or yesterday", () => {
    const days = ["2026-11-20", "2026-11-22", "2026-11-23", "2026-11-24"];
    expect(streak(days, "2026-11-24")).toBe(3);
    expect(streak(days, "2026-11-25")).toBe(3);
    expect(streak(days, "2026-11-26")).toBe(0);
    expect(streak(["2026-12-31", "2027-01-01"], "2027-01-01")).toBe(2);
  });

  it("remembers the best run", () => {
    expect(bestStreak(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-10"])).toBe(3);
    expect(bestStreak([])).toBe(0);
  });
});

describe("achievements", () => {
  const ctx = (stats: Stats, done = {}) => ({ stats, done, sims: SIMS });

  it("records activity once per day", () => {
    let s = record(EMPTY_STATS, { kind: "weather" }, "2026-11-24");
    s = record(s, { kind: "weather" }, "2026-11-24");
    expect(s.days).toEqual(["2026-11-24"]);
    expect(s.weatherRuns).toBe(2);
  });

  it("unlocks from levels, exams and streaks", () => {
    let s = record(EMPTY_STATS, { kind: "level", simId: "emerg-engine-cascais", level: 3, errors: 0 }, "2026-11-22");
    s = record(s, { kind: "exam", score: 100, passed: true }, "2026-11-23");
    s = record(s, { kind: "alphabet", right: 12 }, "2026-11-24");
    const got = unlocked(ctx(s, { "emerg-engine-cascais": { 1: 1, 2: 1, 3: 1 } }));
    for (const id of ["first-level", "three-levels", "perfect", "voice", "emergency", "exam-pass", "exam-ace", "alphabet", "streak-3"])
      expect(got.has(id), id).toBe(true);
    expect(got.has("streak-7")).toBe(false);
    expect(got.has("all-ppl")).toBe(false);
  });

  it("needs every level of every simulation for the licence badges", () => {
    const done = Object.fromEntries(SIMS.filter((x) => x.level === "PPL").map((x) => [x.id, { 1: 1, 2: 1, 3: 1 }]));
    const got = unlocked(ctx(EMPTY_STATS, done));
    expect(got.has("all-ppl")).toBe(true);
    expect(got.has("all-atpl")).toBe(false);
  });
});

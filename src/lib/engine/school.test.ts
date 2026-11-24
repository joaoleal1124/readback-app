import { describe, expect, it } from "vitest";
import sims from "@/server/content/sims.json";
import { JOIN_CODE, cleanCode, daysSince, licenceProgress } from "./school";
import type { Simulation } from "./types";

const SIMS = sims as Simulation[];

describe("school", () => {
  it("counts completed levels per licence", () => {
    const ppl = SIMS.filter((s) => s.level === "PPL");
    const p = licenceProgress([`${ppl[0].id}:1`, `${ppl[0].id}:2`, `${ppl[0].id}:2`, "gone:1", `${ppl[1].id}:9`], SIMS);
    expect(p.PPL.done).toBe(2);
    expect(p.PPL.total).toBe(ppl.length * 3);
    expect(p.ATPL.done).toBe(0);
    expect(p.PPL.pct).toBe(Math.round((2 / (ppl.length * 3)) * 100));
  });

  it("works out days since and tidies join codes", () => {
    expect(daysSince(null)).toBeNull();
    expect(daysSince("2026-11-20T10:00:00Z", Date.parse("2026-11-24T09:00:00Z"))).toBe(3);
    expect(cleanCode(" ab-3 xk9z ")).toBe("AB3XK9");
    expect(JOIN_CODE.test("AB3XK9")).toBe(true);
    expect(JOIN_CODE.test("AB1XK9")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import sims from "@/server/content/sims.json";
import { buildExam, examScore, passed } from "./exam";
import { isQuiz, type Simulation } from "./types";

const SIMS = sims as Simulation[];

describe("exam", () => {
  it("draws 20 different steps of the chosen licence, mostly radio", () => {
    for (let n = 0; n < 50; n++)
      for (const lic of ["PPL", "ATPL"] as const) {
        const exam = buildExam(SIMS, lic);
        expect(exam).toHaveLength(20);
        expect(new Set(exam.map((i) => i.step.id)).size).toBe(20);
        expect(exam.every((i) => i.sim.level === lic)).toBe(true);
        const theory = exam.filter((i) => isQuiz(i.step)).length;
        expect(theory).toBeLessThanOrEqual(5);
        expect(theory).toBeGreaterThan(0);
      }
  });

  it("scores and passes at 75%", () => {
    expect(examScore(15, 20)).toBe(75);
    expect(passed(75)).toBe(true);
    expect(passed(74)).toBe(false);
    expect(examScore(0, 0)).toBe(0);
  });
});

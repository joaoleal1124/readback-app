import { describe, expect, it } from "vitest";
import sims from "@/server/content/sims.json";
import { fillCallsign, normalize } from "./normalize";
import { choiceOptions, correctVersions, gradeStep, referenceOf } from "./grade";
import { toSpeech } from "./speech";
import { newCallsign } from "./callsign";
import { isQuiz, type Simulation } from "./types";

const SIMS = sims as Simulation[];

describe("normalize", () => {
  it("reads spoken digits and phonetic letters", () => {
    expect(normalize("Runway three five, Charlie Sierra Alfa Yankee Bravo")).toBe(" runway 35 csayb ");
  });
  it("keeps frequencies and drops trailing zeros", () => {
    expect(normalize("one three zero decimal six zero zero")).toBe(" 130.6 ");
    expect(normalize("118.000")).toBe(" 118.0 ");
  });
  it("turns spoken altitudes into numbers", () => {
    expect(normalize("not above one thousand five hundred feet")).toBe(" not above 1500 feet ");
  });
  it("understands runway sides", () => {
    expect(normalize("runway two five center")).toBe(normalize("runway 25C"));
    expect(normalize("runway 21, left hand")).toContain(" left hand ");
  });
  it("splits a number said straight into a callsign", () => {
    expect(normalize("QNH one zero one six Charlie Sierra Alfa Yankee Bravo")).toBe(" qnh 1016 csayb ");
  });
});

describe("speech", () => {
  it("speaks a clearance the ICAO way", () => {
    expect(toSpeech("Air Portugal 409, climb FL120, runway 25C, climb 5000 feet.")).toBe(
      "Air Portugal four zero niner, climb flight level one two zero, runway two five center, climb five thousand feet.",
    );
  });
});

describe("emergency phraseology", () => {
  it("says PAN as a word, never spelled", () => {
    expect(toSpeech("Air Portugal 409, roger PAN, descend FL240.")).toBe(
      "Air Portugal four zero niner, roger PAN, descend flight level two four zero.",
    );
  });
});

describe("callsigns", () => {
  it("uses the school callsign for PPL and the airline one for ATPL", () => {
    expect(newCallsign("PPL", () => 0)).toBe("Air Dream College 100");
    expect(newCallsign("ATPL", () => 0.999)).toBe("Air Portugal 999");
  });
});

describe("every simulation step", () => {
  for (const sim of SIMS) {
    const cs = newCallsign(sim.level, () => 0.5);
    for (const step of sim.steps) {
      if (isQuiz(step)) {
        it(`${step.id}: has one answer and three different wrong options`, () => {
          expect(new Set([step.answer, ...step.wrong]).size).toBe(4);
        });
        continue;
      }
      for (const version of correctVersions(step)) {
        const answer = fillCallsign(version, cs);
        it(`${step.id}: accepts "${version}"`, () => {
          expect(gradeStep(step, answer, cs).ok).toBe(true);
        });
        it(`${step.id}: accepts "${version}" said out loud`, () => {
          expect(gradeStep(step, toSpeech(answer).replace(/,/g, ""), cs).ok).toBe(true);
        });
      }
      it(`${step.id}: offers three wrong options, all rejected`, () => {
        const [right, ...wrong] = choiceOptions(step, cs);
        expect(right).toBe(referenceOf(step, cs));
        expect(wrong).toHaveLength(3);
        for (const w of wrong) expect(gradeStep(step, w, cs).ok).toBe(false);
      });
      for (const w of step.wrong ?? [])
        it(`${step.id}: rejects the written wrong option "${w}"`, () => {
          expect(gradeStep(step, fillCallsign(w, cs), cs).ok).toBe(false);
        });
    }
  }
});

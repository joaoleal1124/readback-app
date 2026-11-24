import { describe, expect, it } from "vitest";
import sims from "@/server/content/sims.json";
import { checkAnswer, fillCallsign, normalize } from "./normalize";
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
      const answer = isQuiz(step) ? step.answer : fillCallsign(step.readback, cs);
      it(`${step.id}: accepts the reference answer`, () => {
        expect(checkAnswer(answer, step.keys, cs).ok).toBe(true);
      });
      if (!isQuiz(step)) {
        it(`${step.id}: accepts the reference answer said out loud`, () => {
          expect(checkAnswer(toSpeech(answer).replace(/,/g, ""), step.keys, cs).ok).toBe(true);
        });
      }
      it(`${step.id}: rejects every wrong option`, () => {
        for (const w of step.wrong) expect(checkAnswer(fillCallsign(w, cs), step.keys, cs).ok).toBe(false);
      });
    }
  }
});

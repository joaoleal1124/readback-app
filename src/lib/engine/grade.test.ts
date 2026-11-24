import { describe, expect, it } from "vitest";
import { choiceOptions, gradeStep } from "./grade";
import type { CallStep, TransmissionStep } from "./types";

const CS = "Air Dream College 123";
const tx = (readback: string, accept?: string[]): TransmissionStep => ({
  id: "t",
  phase: "",
  station: "",
  freq: "",
  context_pt: "",
  atc: "",
  atc_pt: "",
  readback,
  readback_pt: "",
  accept,
  note_pt: "",
});
const call = (text: string, accept?: string[]): CallStep => ({
  type: "call",
  id: "c",
  phase: "",
  station: "",
  freq: "",
  context_pt: "",
  task_pt: "",
  call: text,
  call_pt: "",
  accept,
  note_pt: "",
});
const ok = (step: TransmissionStep | CallStep, answer: string) => gradeStep(step, answer, CS).ok;

describe("never accepts a wrong readback", () => {
  const taxi = tx("Taxi to holding point Sierra 4 runway 21 via Uniform and Sierra, hold short of runway 17, {CS}.");
  it("rejects 'cross' said next to 'hold short'", () => {
    expect(ok(taxi, "Taxi to holding point Sierra 4 runway 21 via Uniform and Sierra, cross runway 17, hold short of runway 17, Air Dream College 123")).toBe(false);
  });
  it("rejects 'cross' instead of 'hold short'", () => {
    expect(ok(taxi, "Taxi to holding point Sierra 4 runway 21 via Uniform and Sierra, cross runway 17, Air Dream College 123")).toBe(false);
  });
  const join = tx("Join right downwind runway 35, QNH 1015, wilco, {CS}.");
  it("rejects a wrong QNH said next to the right one", () => {
    expect(ok(join, "Join right downwind runway 35, QNH 1051 1015, wilco, Air Dream College 123")).toBe(false);
  });
  it("rejects two runways in one readback", () => {
    expect(ok(join, "Join right downwind runway 17 runway 35, QNH 1015, wilco, Air Dream College 123")).toBe(false);
  });
  it("rejects the wrong side", () => {
    expect(ok(join, "Join left downwind runway 35, QNH 1015, wilco, Air Dream College 123")).toBe(false);
  });
  it("rejects a missing element", () => {
    expect(ok(join, "Join right downwind runway 35, wilco, Air Dream College 123")).toBe(false);
  });
  it("rejects the callsign at the start of a readback", () => {
    const g = gradeStep(join, "Air Dream College 123, join right downwind runway 35, QNH 1015, wilco", CS);
    expect(g.ok).toBe(false);
    expect(g.hints.join(" ")).toContain("no fim do readback");
  });
  it("rejects a readback without the callsign", () => {
    expect(ok(join, "Join right downwind runway 35, QNH 1015, wilco")).toBe(false);
  });
  it("rejects an abbreviated callsign the controller never used", () => {
    expect(ok(join, "Join right downwind runway 35, QNH 1015, wilco, College 123")).toBe(false);
  });
  it("rejects a 'roger' in front and says why", () => {
    const g = gradeStep(join, "Roger, join right downwind runway 35, QNH 1015, wilco, Air Dream College 123", CS);
    expect(g.ok).toBe(false);
    expect(g.extra).toEqual(["roger"]);
  });
  it("rejects elements out of order", () => {
    expect(ok(join, "QNH 1015, join right downwind runway 35, wilco, Air Dream College 123")).toBe(false);
  });
  it("rejects 'point' and explains 'decimal'", () => {
    const g = gradeStep(tx("Lisboa Information 123.755, {CS}."), "Lisboa Information 123 point 755, Air Dream College 123", CS);
    expect(g.ok).toBe(false);
    expect(g.hints.join(" ")).toContain("decimal");
  });
  it("rejects grouped numbers and explains", () => {
    const g = gradeStep(tx("Descend FL100, speed 250 knots, {CS}."), "Descend FL100, speed two fifty knots, Air Dream College 123", CS);
    expect(g.ok).toBe(false);
    expect(g.hints.join(" ")).toContain("algarismo");
  });
  it("rejects a missing 'wilco' when a report was asked for", () => {
    expect(ok(join, "Join right downwind runway 35, QNH 1015, Air Dream College 123")).toBe(false);
  });
  it("rejects an extra word in a pilot call", () => {
    const c = call("Cascais Tower, {CS}, ready for departure.");
    expect(ok(c, "Cascais Tower, Air Dream College 123, ready for take-off")).toBe(false);
  });
});

describe("accepts the right readback however it is written or said", () => {
  const rb = tx("Left heading 200, descend altitude 3000 feet, cleared ILS approach runway 17, wilco, {CS}.");
  it("with or without words that change nothing", () => {
    expect(ok(rb, "turn left heading 200 descend to altitude 3000 cleared ILS approach runway 17 wilco Air Dream College 123")).toBe(true);
  });
  it("said out loud, the ICAO way", () => {
    expect(
      ok(rb, "left heading two zero zero descend altitude tree thousand feet cleared ILS approach runway one seven wilco Air Dream College one two tree"),
    ).toBe(true);
  });
  it("accepts another correct version", () => {
    const f = tx("Lisboa Information 123.755, {CS}.", ["123.755, {CS}."]);
    expect(ok(f, "123.755, Air Dream College 123")).toBe(true);
  });
});

describe("multiple choice", () => {
  it("gives the right answer and three wrong ones, each with one mistake", () => {
    const step = tx("Runway 35, cleared to land, {CS}.");
    const [right, ...wrong] = choiceOptions(step, CS);
    expect(right).toBe("Runway 35, cleared to land, Air Dream College 123.");
    expect(wrong).toHaveLength(3);
    for (const w of wrong) expect(ok(step, w)).toBe(false);
  });
});

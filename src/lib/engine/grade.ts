/**
 * Strict grading of radio answers.
 *
 * A readback or a pilot call is right only when it says every element of a correct version,
 * in the same order, and nothing else. Words that carry no instruction ("the", "to", "feet",
 * "knots"…) may be said or left out. Anything extra — a second runway, another QNH, "cross"
 * next to "hold short", a "roger" in front — makes the answer wrong. A wrong answer is never
 * accepted because the right words also appear somewhere in it.
 */
import { fillCallsign, normalize } from "./normalize";
import { isCall, isQuiz, type Step } from "./types";

/** Words that may be said or left out anywhere: they change nothing in the instruction. */
export const OPTIONAL = new Set([
  "the",
  "to",
  "and",
  "of",
  "turn",
  "feet",
  "ft",
  "knots",
  "kt",
  "degrees",
  "hectopascals",
  "hectopascal",
  "at",
]);

const tokens = (text: string) => normalize(text).trim().split(/\s+/).filter(Boolean);
/**
 * The words that count, in order. Neighbouring figures are joined, and so are neighbouring short
 * letter groups: on the radio "heading 180, 2 persons" and "information Bravo, VFR" are said
 * without a pause, so "1802" and "bvfr" must mean the same as the written version.
 */
function core(text: string): string[] {
  const out: string[] = [];
  const kind = (w: string) => (/^\d+$/.test(w) ? "n" : /^[a-z]{1,3}$/.test(w) ? "l" : "");
  for (const w of tokens(text)) {
    if (OPTIONAL.has(w)) continue;
    const prev = out[out.length - 1];
    if (prev !== undefined && kind(w) && kind(prev) === kind(w) && prevKind(prev) === kind(w)) out[out.length - 1] = prev + w;
    else out.push(w);
  }
  return out;
}
const prevKind = (w: string) => (/^\d+$/.test(w) ? "n" : /^[a-z]+$/.test(w) && w.length <= 3 ? "l" : "");
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** The correct versions of a step, as written (with {CS}). The first one is the reference. */
export function correctVersions(step: Step): string[] {
  if (isQuiz(step)) return [step.answer];
  if (isCall(step)) return [step.call, ...(step.accept ?? [])];
  return [step.readback, ...(step.accept ?? [])];
}

export const referenceOf = (step: Step, callsign: string) => fillCallsign(correctVersions(step)[0], callsign);

export type ClauseStatus = "ok" | "order" | "missing";
export interface ClauseResult {
  label: string;
  ok: boolean;
  status: ClauseStatus;
}
export interface Grade {
  ok: boolean;
  /** Each element of the reference answer and whether it was said, and in the right place. */
  results: ClauseResult[];
  /** Words said that are not part of the reference answer. */
  extra: string[];
  /** Short explanations of typical mistakes, in Portuguese. */
  hints: string[];
}

function findSeq(hay: string[], used: boolean[], needle: string[], from: number): number {
  for (let i = from; i + needle.length <= hay.length; i++) {
    let hit = true;
    for (let j = 0; j < needle.length; j++) {
      if (used[i + j] || hay[i + j] !== needle[j]) {
        hit = false;
        break;
      }
    }
    if (hit) return i;
  }
  return -1;
}

const NUMBER_WORDS =
  /^(ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)$/;

/** Grades a typed or spoken answer for a radio step (readback or pilot call). */
export function gradeStep(step: Step, answer: string, callsign: string): Grade {
  const versions = correctVersions(step).map((v) => fillCallsign(v, callsign));
  const said = core(answer);
  const ok = said.length > 0 && versions.some((v) => same(core(v), said));

  const clauses = versions[0]
    .split(/[,.;]/)
    .map((c) => c.trim())
    .filter((c) => core(c).length > 0);
  if (ok) return { ok, results: clauses.map((label) => ({ label, ok: true, status: "ok" })), extra: [], hints: [] };

  const used = said.map(() => false);
  let pointer = 0;
  const results: ClauseResult[] = clauses.map((label) => {
    const need = core(label);
    let at = findSeq(said, used, need, pointer);
    let status: ClauseStatus = "ok";
    if (at >= 0) pointer = at + need.length;
    else {
      at = findSeq(said, used, need, 0);
      status = at >= 0 ? "order" : "missing";
    }
    if (at >= 0) for (let j = 0; j < need.length; j++) used[at + j] = true;
    return { label, ok: status === "ok", status };
  });
  const extra = said.filter((_, i) => !used[i]);

  const hints: string[] = [];
  const all = tokens(answer);
  const ref = core(versions[0]);
  if (all.includes("point")) hints.push("Diz «decimal», não «point» (ICAO Anexo 10, Vol. II, 5.2.1.4).");
  if (all.some((w) => NUMBER_WORDS.test(w)))
    hints.push("Diz os números algarismo a algarismo, por exemplo «two five zero», não «two fifty» (ICAO Anexo 10, Vol. II, 5.2.1.4).");
  if (extra.includes("roger") && !ref.includes("roger"))
    hints.push("Num readback não se diz «roger»: repete os elementos e termina com o indicativo.");
  const csLabel = callsign.trim();
  const csResult = results.find((r) => r.label === csLabel);
  if (csResult && csResult.status === "order")
    hints.push(isCall(step) ? "O indicativo vai logo a seguir ao nome da estação chamada." : "O indicativo vai no fim do readback.");
  if (results.some((r) => r.status === "order") && !hints.some((h) => h.includes("indicativo")))
    hints.push("Diz os elementos pela mesma ordem em que o ATC os deu.");
  if (extra.length && !results.some((r) => !r.ok))
    hints.push("Disseste palavras a mais. Num readback não acrescentes nada que não tenha sido dito.");
  return { ok, results, extra, hints };
}

/* ---------------- multiple choice ---------------- */

function seeded(seed: string): () => number {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function shuffleWith<T>(a: T[], r: () => number): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** The same order every time for the same seed, so options do not jump around between renders. */
export const stableShuffle = <T,>(a: T[], seed: string) => shuffleWith(a, seeded(seed));

const pad = (n: number, w: number) => String(n).padStart(w, "0");
const keepCase = (from: string, to: string) => (from[0] === from[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to);

const FLIPS: [string, string][] = [
  ["left", "right"],
  ["climb", "descend"],
  ["climbing", "descending"],
  ["QNH", "QFE"],
  ["inbound", "outbound"],
  ["above", "below"],
  ["hold short of", "cross"],
  ["cleared to land", "cleared touch and go"],
  ["line up and wait", "cleared for take-off"],
  ["north", "south"],
  ["east", "west"],
  ["ready for departure", "ready for take-off"],
  ["downwind", "base"],
  ["Tower", "Ground"],
  ["maintaining", "leaving"],
  ["established on the localizer", "established on the glide path"],
  ["runway vacated", "runway clear"],
  ["touch and go", "full stop"],
  ["going around", "missed approach"],
  ["holding at", "leaving"],
  ["final", "base"],
  ["request taxi", "ready to taxi"],
];

/** One plausible change to a number: the kind of slip a student makes when listening. */
function changeNumber(text: string, start: number, match: string, before: string): string {
  const word = before.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
  let out = match;
  const fl = /^FL(\d+)$/.exec(match);
  const rwy = /^(\d{1,2})([LRC]?)$/.exec(match);
  if (fl) out = `FL${pad(Number(fl[1]) + 10, fl[1].length)}`;
  else if (word === "runway" && rwy) {
    if (rwy[2] === "L") out = `${rwy[1]}R`;
    else if (rwy[2] === "R") out = `${rwy[1]}L`;
    else if (rwy[2] === "C") out = `${rwy[1]}L`;
    else out = pad(((Number(rwy[1]) + 17) % 36) + 1, 2);
  } else if (/^\d+\.\d+$/.test(match)) {
    const [a, b] = match.split(".");
    out = b.length >= 2 && b.at(-1) !== b.at(-2) ? `${a}.${b.slice(0, -2)}${b.at(-1)}${b.at(-2)}` : `${a}.${b.slice(0, -1)}${(Number(b.at(-1)) + 2) % 10}`;
  } else if (/^\d+$/.test(match)) {
    const n = Number(match);
    if (word === "squawk") {
      const d = match.split("");
      if (d[1] !== d[2]) [d[1], d[2]] = [d[2], d[1]];
      else d[3] = String((Number(d[3]) + 1) % 8);
      out = d.join("");
    } else if (["qnh", "qfe", "altimeter"].includes(word)) out = String(n + 2);
    else if (word === "heading") out = pad(((n + 20 - 1) % 360) + 1, 3);
    else if (n >= 1000 && n % 100 === 0) out = String(n + 1000);
    else if (match.length >= 2 && match.at(-1) !== match.at(-2)) out = `${match.slice(0, -2)}${match.at(-1)}${match.at(-2)}`;
    else out = `${match.slice(0, -1)}${(n + 1) % 10}`;
  }
  return text.slice(0, start) + out + text.slice(start + match.length);
}

/** Wrong versions of a correct answer, each with one typical mistake. */
type MutationKind = "detail" | "drop" | "callsign" | "generic";
export function mutations(template: string, isPilotCall: boolean): { kind: MutationKind; text: string }[] {
  const out: { kind: MutationKind; text: string }[] = [];
  for (const m of template.matchAll(/(?<![A-Za-z0-9{.])(FL\d+|\d+(?:\.\d+)?[LRC]?)(?![A-Za-z0-9}])/g)) {
    const t = changeNumber(template, m.index, m[0], template.slice(0, m.index));
    if (t !== template) out.push({ kind: "detail", text: t });
  }
  for (const [a, b] of FLIPS) {
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      const re = new RegExp(`\\b${x}\\b`, "i");
      const m = re.exec(template);
      if (m) out.push({ kind: "detail", text: template.slice(0, m.index) + keepCase(m[0], y) + template.slice(m.index + m[0].length) });
    }
  }
  const clauses = template.replace(/\.$/, "").split(", ");
  if (clauses.length >= 3) {
    clauses.forEach((c, i) => {
      if (c.includes("{CS}") || (isPilotCall && i === 0)) return;
      out.push({ kind: "drop", text: clauses.filter((_, j) => j !== i).join(", ") + "." });
    });
  }
  if (!isPilotCall && template.trim().endsWith("{CS}.")) {
    const body = template.trim().replace(/,?\s*\{CS\}\.$/, "");
    out.push({ kind: "callsign", text: `{CS}, ${body[0].toLowerCase()}${body.slice(1)}.` });
    out.push({ kind: "generic", text: "Roger, {CS}." });
    out.push({ kind: "generic", text: `${body}.` });
  }
  if (isPilotCall && template.includes("{CS}, ")) {
    out.push({ kind: "callsign", text: template.replace("{CS}, ", "").replace(/\.$/, ", {CS}.") });
    out.push({ kind: "generic", text: template.replace("{CS}, ", "") });
  }
  return out;
}

/** The reference answer plus three wrong options, in a fixed order per step (shuffle before showing). */
export function choiceOptions(step: Step, callsign: string): string[] {
  const reference = referenceOf(step, callsign);
  if (isQuiz(step)) return [reference, ...step.wrong.slice(0, 3)];
  const r = seeded(step.id);
  const template = correctVersions(step)[0];
  const muts = mutations(template, isCall(step));
  const details = shuffleWith(
    muts.filter((m) => m.kind === "detail"),
    r,
  ).map((m) => m.text);
  const drops = shuffleWith(
    muts.filter((m) => m.kind === "drop"),
    r,
  ).map((m) => m.text);
  const moved = muts.filter((m) => m.kind === "callsign").map((m) => m.text);
  const generic = muts.filter((m) => m.kind === "generic").map((m) => m.text);
  const authored = step.wrong ?? [];
  const pool = [
    ...details.slice(0, 2),
    ...authored.slice(0, 1),
    ...drops.slice(0, 1),
    ...details.slice(2, 3),
    ...moved,
    ...authored.slice(1),
    ...details.slice(3),
    ...drops.slice(1),
    ...generic,
  ];
  const seen = new Set([core(reference).join(" ")]);
  const wrong: string[] = [];
  for (const t of pool) {
    if (wrong.length === 3) break;
    const text = fillCallsign(t, callsign);
    const key = core(text).join(" ");
    if (seen.has(key) || gradeStep(step, text, callsign).ok) continue;
    seen.add(key);
    wrong.push(text);
  }
  return [reference, ...wrong];
}

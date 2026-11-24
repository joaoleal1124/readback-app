/** NATO alphabet and ICAO number drills: item generators and answer checking. */

export const NATO: Record<string, string> = {
  A: "Alfa", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot", G: "Golf", H: "Hotel",
  I: "India", J: "Juliett", K: "Kilo", L: "Lima", M: "Mike", N: "November", O: "Oscar", P: "Papa",
  Q: "Quebec", R: "Romeo", S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey",
  X: "X-ray", Y: "Yankee", Z: "Zulu",
};
export const LETTERS = Object.keys(NATO);

/** ICAO radiotelephony digits (Annex 10): "tree", "fife" and "niner" are the official forms. */
const DIGIT_WORD = ["zero", "one", "two", "tree", "four", "fife", "six", "seven", "eight", "niner"];
const ONES = ["", "one", "two", "tree", "four", "fife", "six", "seven", "eight", "niner"];

/** Everyday spellings that mean the same radio word. */
const SAME: Record<string, string> = {
  alpha: "alfa",
  juliet: "juliett",
  whisky: "whiskey",
  xray: "x-ray",
  three: "tree",
  five: "fife",
  nine: "niner",
  point: "decimal",
  hundreds: "hundred",
  thousands: "thousand",
  feet: "feet",
  ft: "feet",
};

const VOCAB = new Set([
  ...Object.values(NATO).map((w) => w.toLowerCase()),
  ...DIGIT_WORD,
  ...["decimal", "hundred", "thousand", "feet", "heading", "squawk", "flight", "level"],
]);

export type DrillKind = "letter" | "hear" | "reg" | "freq" | "heading" | "altitude" | "level" | "squawk";

export interface DrillItem {
  kind: DrillKind;
  /** What the student sees (or hears, for "hear"). */
  prompt: string;
  /** The answer in radio words. */
  spoken: string;
  /** Multiple-choice options (letter and hear drills only). */
  options?: string[];
}

type Rand = () => number;
const pick = <T,>(a: readonly T[], r: Rand) => a[Math.floor(r() * a.length)];
const int = (lo: number, hi: number, r: Rand) => lo + Math.floor(r() * (hi - lo + 1));
const sayDigits = (s: string) =>
  s
    .split("")
    .map((c) => (c === "." ? "decimal" : DIGIT_WORD[Number(c)]))
    .join(" ");

/** 3500 → "tree thousand fife hundred", 12000 → "one two thousand" (ICAO way). */
export function sayAltitude(feet: number): string {
  const th = Math.floor(feet / 1000);
  const h = Math.floor((feet % 1000) / 100);
  const parts: string[] = [];
  if (th) parts.push(`${th >= 10 ? sayDigits(String(th)) : ONES[th]} thousand`);
  if (h) parts.push(`${ONES[h]} hundred`);
  return `${parts.join(" ")} feet`;
}

function choices(right: string, pool: string[], r: Rand, n = 4): string[] {
  const set = new Set([right]);
  while (set.size < n) set.add(pick(pool, r));
  return [...set].sort(() => r() - 0.5);
}

const COUNTRY_PREFIX = ["CS", "EC", "F", "D", "G", "N", "EI", "OO", "PH", "HB", "OE", "SE"];

export function makeItem(kind: DrillKind, r: Rand = Math.random): DrillItem {
  switch (kind) {
    case "letter": {
      const l = pick(LETTERS, r);
      return { kind, prompt: l, spoken: NATO[l], options: choices(NATO[l], Object.values(NATO), r) };
    }
    case "hear": {
      const l = pick(LETTERS, r);
      return { kind, prompt: NATO[l], spoken: l, options: choices(l, LETTERS, r) };
    }
    case "reg": {
      const pre = pick(COUNTRY_PREFIX, r);
      const len = pre === "N" ? 0 : 5 - pre.length;
      const tail =
        pre === "N"
          ? `${int(100, 999, r)}${pick(LETTERS, r)}${pick(LETTERS, r)}`
          : Array.from({ length: Math.max(3, len) }, () => pick(LETTERS, r)).join("");
      const reg = pre === "N" ? `N${tail}` : `${pre}-${tail}`;
      const spoken = reg
        .replace("-", "")
        .split("")
        .map((c) => (/\d/.test(c) ? DIGIT_WORD[Number(c)] : NATO[c]))
        .join(" ");
      return { kind, prompt: reg, spoken };
    }
    case "freq": {
      const mhz = int(118, 135, r);
      const khz = pick(["0", "05", "1", "15", "2", "25", "3", "35", "4", "45", "5", "55", "6", "65", "7", "75", "8", "85", "9", "95"], r);
      const f = `${mhz}.${khz}`;
      return { kind, prompt: f, spoken: sayDigits(f) };
    }
    case "heading": {
      const h = int(1, 36, r) * 10;
      const s = String(h).padStart(3, "0");
      return { kind, prompt: `HDG ${s}`, spoken: `heading ${sayDigits(s)}` };
    }
    case "altitude": {
      const ft = pick([1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7000, 8500, 10000, 11000, 12500], r);
      return { kind, prompt: `${ft} ft`, spoken: sayAltitude(ft) };
    }
    case "level": {
      const fl = String(int(5, 41, r) * 10).padStart(3, "0");
      return { kind, prompt: `FL${fl}`, spoken: `flight level ${sayDigits(fl)}` };
    }
    case "squawk": {
      const s = Array.from({ length: 4 }, () => int(0, 7, r)).join("");
      return { kind, prompt: `SQ ${s}`, spoken: `squawk ${sayDigits(s)}` };
    }
  }
}

/** A mixed session: alphabet first, then registrations and numbers. */
export function makeSession(n = 12, r: Rand = Math.random): DrillItem[] {
  const plan: DrillKind[] = ["letter", "letter", "hear", "hear", "reg", "reg", "freq", "heading", "altitude", "level", "squawk", "freq"];
  return plan.slice(0, n).map((k) => makeItem(k, r));
}

/** Lower-case words with the everyday spellings turned into the radio ones. */
export function radioWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/x\s*-\s*ray/g, "x-ray")
    .replace(/[^a-z0-9.\- ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => SAME[w] ?? SAME[w.replace(/-/g, "")] ?? w);
}

export interface DrillCheck {
  ok: boolean;
  /** The student typed figures or letters instead of saying them. */
  usedFigures: boolean;
}

/** Spoken answers must say every letter and figure in radio words, in order. */
export function checkSpoken(answer: string, spoken: string): DrillCheck {
  const got = radioWords(answer);
  const usedFigures = got.some((w) => !VOCAB.has(w));
  const want = radioWords(spoken);
  const OPTIONAL = new Set(["feet", "heading", "squawk"]);
  const strip = (ws: string[]) => ws.filter((w) => !OPTIONAL.has(w));
  const ok = strip(got).join(" ") === strip(want).join(" ");
  return { ok, usedFigures: !ok && usedFigures };
}

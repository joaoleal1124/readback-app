/**
 * Answer normalisation for radiotelephony readbacks.
 *
 * Typed and spoken answers come in many shapes ("runway 35", "runway three five",
 * "CS-AYB", "Charlie Sierra Alfa Yankee Bravo", "130.600", "one three zero decimal six").
 * Both the student's answer and each expected key go through `normalize`, so they meet
 * in one canonical form and a plain substring test decides whether a key is present.
 */

const DIGITS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", tree: "3", four: "4", fower: "4",
  five: "5", fife: "5", six: "6", seven: "7", eight: "8", nine: "9", niner: "9",
  decimal: ".",
};

const PHONETIC: Record<string, string> = {
  alfa: "a", alpha: "a", bravo: "b", charlie: "c", delta: "d", echo: "e", foxtrot: "f",
  golf: "g", hotel: "h", india: "i", juliett: "j", juliet: "j", kilo: "k", lima: "l",
  mike: "m", november: "n", oscar: "o", papa: "p", quebec: "q", romeo: "r", sierra: "s",
  tango: "t", uniform: "u", victor: "v", whiskey: "w", whisky: "w", xray: "x", yankee: "y",
  zulu: "z",
};

const RUNWAY_SIDE: Record<string, string> = { left: "l", right: "r", center: "c", centre: "c" };
const NOT_A_RUNWAY_SIDE = /^(hand|turn|base|downwind|circuit|heading)$/;
const BREAK = "|";

export function normalize(input: string): string {
  let s = ` ${input.toLowerCase()} `;
  s = s.replace(/take[\s-]?off/g, "takeoff").replace(/x-ray/g, "xray").replace(/-/g, "");
  s = s.replace(/flight level/g, "fl").replace(/\bfl\s*(\d)/g, "fl $1");
  // keep decimal points between digits, turn clause punctuation into breaks, drop the rest
  s = s
    .replace(/(\d)\.(\d)/g, "$1§$2")
    .replace(/[,;:]/g, ` ${BREAK} `)
    .replace(/[.!?"'()/]/g, " ")
    .replace(/§/g, ".");

  const words = s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => DIGITS[w] ?? PHONETIC[w] ?? w);

  // join runs of single characters: "c s a y b" -> "csayb", "1 3 0 . 6" -> "130.6"
  const joined: string[] = [];
  let joining = false;
  for (const w of words) {
    if (w === BREAK) {
      joining = false;
      continue;
    }
    if (w.length === 1) {
      if (joining) joined[joined.length - 1] += w;
      else {
        joined.push(w);
        joining = true;
      }
    } else {
      joined.push(w);
      joining = false;
    }
  }

  // "runway 25 center" -> "runway 25c" (but not "runway 21, left hand")
  const sided: string[] = [];
  joined.forEach((w, i) => {
    const prev = sided[sided.length - 1];
    const prev2 = sided[sided.length - 2];
    if (
      RUNWAY_SIDE[w] &&
      prev &&
      /^\d{1,2}$/.test(prev) &&
      prev2 === "runway" &&
      !NOT_A_RUNWAY_SIDE.test(joined[i + 1] ?? "")
    ) {
      sided[sided.length - 1] = prev + RUNWAY_SIDE[w];
    } else sided.push(w);
  });

  // split mixed runs at digit/letter edges ("1016csayb" -> "1016 csayb", "25c" -> "25 c")
  const tokens = sided
    .flatMap((w) =>
      /^[a-z0-9.]+$/.test(w) && /\d/.test(w) && /[a-z]/.test(w) ? (w.match(/[0-9.]+|[a-z]+/g) ?? [w]) : [w],
    )
    .map((w) => (w.length > 1 ? w.replace(/^\./, "") : w))
    .filter((w) => w !== ".");

  // spoken altitudes and trailing zeros in frequencies
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^\d+$/.test(t) && tokens[i + 1] === "thousand") {
      let v = Number(t) * 1000;
      i++;
      if (/^\d+$/.test(tokens[i + 1] ?? "") && tokens[i + 2] === "hundred") {
        v += Number(tokens[i + 1]) * 100;
        i += 2;
      }
      out.push(String(v));
    } else if (/^\d+$/.test(t) && tokens[i + 1] === "hundred") {
      out.push(String(Number(t) * 100));
      i++;
    } else if (/^\d+\.\d+$/.test(t)) {
      let x = t.replace(/0+$/, "");
      if (x.endsWith(".")) x += "0";
      out.push(x);
    } else out.push(t);
  }
  return ` ${out.join(" ")} `;
}

/** Replaces the {CS} placeholder with the student's callsign. */
export const fillCallsign = (text: string, callsign: string) => text.split("{CS}").join(callsign);

/** True when the normalised answer contains the key (or one of its "|" alternatives). */
export function hasKey(normalizedAnswer: string, key: string, callsign: string): boolean {
  return fillCallsign(key, callsign)
    .split("|")
    .some((k) => normalizedAnswer.includes(normalize(k)));
}

export interface KeyResult {
  label: string;
  ok: boolean;
}

/** Checks a free-text answer against every key of a step. */
export function checkAnswer(answer: string, keys: string[], callsign: string): { ok: boolean; results: KeyResult[] } {
  const n = normalize(answer);
  const results = keys.map((k) => ({ label: fillCallsign(k, callsign).split("|")[0], ok: hasKey(n, k, callsign) }));
  return { ok: results.every((r) => r.ok), results };
}

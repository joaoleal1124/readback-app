/** Turns written ATC phraseology into the words a controller would say (ICAO pronunciation). */

const SAY_DIGIT = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "niner"];
const SAY_LETTER: Record<string, string> = {
  A: "Alfa", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot", G: "Golf", H: "Hotel",
  I: "India", J: "Juliett", K: "Kilo", L: "Lima", M: "Mike", N: "November", O: "Oscar", P: "Papa",
  Q: "Quebec", R: "Romeo", S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey",
  X: "X-ray", Y: "Yankee", Z: "Zulu",
};
const SAY_SIDE: Record<string, string> = { L: "left", R: "right", C: "center" };
const SAY_AS_WORD = new Set(["ILS", "VOR", "QNH", "QFE", "ATC", "ATIS", "PAN", "I"]);
const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

const digits = (s: string) => s.split("").map((c) => (c === "." ? "decimal" : SAY_DIGIT[Number(c)])).join(" ");
const spell = (s: string) => s.split("").map((c) => SAY_LETTER[c] ?? c).join(" ");

/** 1500 -> "one thousand five hundred", 12000 -> "one two thousand". */
function altitude(value: string): string {
  const n = Number(value);
  const th = Math.floor(n / 1000);
  const h = Math.floor((n % 1000) / 100);
  const parts: string[] = [];
  if (th) parts.push(`${th >= 10 ? digits(String(th)) : ONES[th]} thousand`);
  if (h) parts.push(`${ONES[h]} hundred`);
  return parts.join(" ") || digits(String(n));
}

export function toSpeech(text: string): string {
  return text
    // 25 kHz channels ending in two zeros: only the first four digits (Annex 10 Vol II, 5.2.1.7.3.4.3)
    .replace(/\b(1[1-3]\d)\.(\d)00\b/g, "$1.$2")
    // US altimeter settings: "two niner niner two", no "decimal" (FAA JO 7110.65, 2-7-1)
    .replace(/\baltimeter (\d\d)\.(\d\d)\b/g, "altimeter $1$2")
    .replace(/\b(\d{4,5})(?=\s+feet)/g, (_, n: string) => altitude(n))
    .replace(/\b(maintain|climb|descend|altitude) (\d{4,5})\b/g, (m, w: string, n: string) =>
      Number(n) % 100 === 0 ? `${w} ${altitude(n)}` : m,
    )
    .replace(/\bFL(\d+)/g, (_, n: string) => `flight level ${digits(n)}`)
    .replace(/\bMach \.(\d+)/g, (_, n: string) => `Mach decimal ${digits(n)}`)
    .replace(/\brunway (\d{1,2})([LRC])\b/g, (_, n: string, l: string) => `runway ${digits(n)} ${SAY_SIDE[l]}`)
    .replace(/\b([A-Z]{1,2})-([A-Z]{2,4})\b/g, (_, a: string, b: string) => spell(a + b))
    .replace(/\b(\d+)([A-Z])\b/g, (_, n: string, l: string) => `${digits(n)} ${SAY_LETTER[l]}`)
    .replace(/\b(\d+(?:\.\d+)?)\b/g, (_, n: string) => digits(n))
    .replace(/\b[A-Z]{1,3}\b/g, (m) => (SAY_AS_WORD.has(m) ? m : spell(m)));
}

/** Splits a transmission into phrases so the voice pauses between the parts of a clearance. */
export const toPhrases = (text: string) => toSpeech(text).split(/,\s*/).filter(Boolean);

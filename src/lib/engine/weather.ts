/** ATIS and METAR drills: random but realistic weather, its METAR code, the ATIS broadcast and questions. */
import { NATO } from "./phonetic";

type Rand = () => number;
const pick = <T,>(a: readonly T[], r: Rand) => a[Math.floor(r() * a.length)];
const int = (lo: number, hi: number, r: Rand) => lo + Math.floor(r() * (hi - lo + 1));
const pad = (n: number, w: number) => String(n).padStart(w, "0");

interface Airport {
  icao: string;
  name: string;
  /** Runway designators as published, e.g. "03", "14L", "07C". */
  runways: string[];
  elevation: number;
}

export const AIRPORTS: Airport[] = [
  { icao: "LPPT", name: "Lisbon", runways: ["03", "21"], elevation: 374 },
  { icao: "LPPR", name: "Porto", runways: ["17", "35"], elevation: 228 },
  { icao: "LPFR", name: "Faro", runways: ["10", "28"], elevation: 24 },
  { icao: "LPMA", name: "Madeira", runways: ["05", "23"], elevation: 192 },
  { icao: "LPAZ", name: "Santa Maria", runways: ["18", "36"], elevation: 308 },
  { icao: "LEMD", name: "Madrid Barajas", runways: ["14L", "14R", "18L", "18R", "32L", "32R", "36L", "36R"], elevation: 1998 },
  { icao: "LEBL", name: "Barcelona", runways: ["06L", "06R", "24L", "24R", "02", "20"], elevation: 13 },
  { icao: "EGLL", name: "Heathrow", runways: ["09L", "09R", "27L", "27R"], elevation: 83 },
  { icao: "EGKB", name: "Biggin Hill", runways: ["03", "21"], elevation: 598 },
  { icao: "LFPG", name: "Charles de Gaulle", runways: ["08L", "08R", "09L", "09R", "26L", "26R", "27L", "27R"], elevation: 392 },
  { icao: "EDDF", name: "Frankfurt", runways: ["07L", "07C", "07R", "25L", "25C", "25R", "18"], elevation: 364 },
  { icao: "LIRF", name: "Rome Fiumicino", runways: ["16L", "16R", "34L", "34R", "07", "25"], elevation: 15 },
  { icao: "OMDB", name: "Dubai", runways: ["12L", "12R", "30L", "30R"], elevation: 62 },
];

export interface Cloud {
  cover: "FEW" | "SCT" | "BKN" | "OVC";
  base: number; // feet
}

export interface Weather {
  airport: Airport;
  info: string; // ATIS letter
  time: string; // HHMM UTC
  day: number;
  runway: string;
  windDir: number;
  windSpeed: number;
  gust?: number;
  visibility: number; // metres, 9999 = 10 km or more
  cavok: boolean;
  clouds: Cloud[];
  temp: number;
  dew: number;
  qnh: number;
  trend: "NOSIG" | "BECMG" | "TEMPO";
}

/** Picks a runway most into the wind; among parallels with the same heading, one at random. */
function runwayFor(runways: string[], windDir: number, r: Rand): string {
  const diff = (rw: string) => {
    const d = Math.abs(parseInt(rw, 10) * 10 - windDir) % 360;
    return d > 180 ? 360 - d : d;
  };
  const best = Math.min(...runways.map(diff));
  return pick(runways.filter((rw) => diff(rw) === best), r);
}

export function makeWeather(r: Rand = Math.random): Weather {
  const airport = pick(AIRPORTS, r);
  const windDir = int(1, 36, r) * 10;
  const windSpeed = int(3, 24, r);
  const gust = windSpeed >= 14 && r() < 0.5 ? windSpeed + int(8, 14, r) : undefined;
  const cavok = r() < 0.25;
  const visibility = cavok ? 9999 : pick([9999, 9999, 8000, 6000, 4000, 2500], r);
  const clouds: Cloud[] = [];
  if (!cavok) {
    const first = int(8, 30, r) * 100;
    clouds.push({ cover: pick(["FEW", "SCT"] as const, r), base: first });
    if (r() < 0.7) clouds.push({ cover: pick(["BKN", "OVC"] as const, r), base: first + int(5, 30, r) * 100 });
  }
  const temp = int(2, 34, r);
  const runway = runwayFor(airport.runways, windDir, r);
  return {
    airport,
    info: pick(Object.keys(NATO), r),
    time: `${pad(int(0, 23, r), 2)}${pick(["20", "50"], r)}`,
    day: int(1, 28, r),
    runway,
    windDir,
    windSpeed,
    gust,
    visibility,
    cavok,
    clouds,
    temp,
    dew: temp - int(1, 12, r),
    qnh: int(996, 1032, r),
    trend: pick(["NOSIG", "NOSIG", "BECMG", "TEMPO"] as const, r),
  };
}

const tempCode = (t: number) => (t < 0 ? `M${pad(-t, 2)}` : pad(t, 2));

export function toMetar(w: Weather): string {
  const wind = `${pad(w.windDir, 3)}${pad(w.windSpeed, 2)}${w.gust ? `G${w.gust}` : ""}KT`;
  const sky = w.cavok ? "CAVOK" : `${pad(w.visibility, 4)} ${w.clouds.map((c) => `${c.cover}${pad(c.base / 100, 3)}`).join(" ")}`;
  return `${w.airport.icao} ${pad(w.day, 2)}${w.time}Z ${wind} ${sky} ${tempCode(w.temp)}/${tempCode(w.dew)} Q${w.qnh} ${w.trend}`;
}

const COVER_WORD = { FEW: "few", SCT: "scattered", BKN: "broken", OVC: "overcast" };
const SIDE_WORD: Record<string, string> = { L: " left", R: " right", C: " centre" };

/** The ATIS broadcast, written so the voice reads it the ICAO way. */
export function toAtis(w: Weather): string {
  const rwy = w.runway.replace(/[LRC]$/, (s) => SIDE_WORD[s]);
  const vis = w.visibility === 9999 ? "10 kilometres or more" : `${w.visibility} metres`;
  const parts = [
    `This is ${w.airport.name} information ${NATO[w.info]}, time ${w.time}`,
    `Runway in use ${rwy}`,
    `Wind ${pad(w.windDir, 3)} degrees ${w.windSpeed} knots${w.gust ? `, gusting ${w.gust} knots` : ""}`,
    w.cavok ? "CAVOK" : `Visibility ${vis}`,
    ...(w.cavok ? [] : w.clouds.map((c) => `${COVER_WORD[c.cover]} ${c.base} feet`)),
    `Temperature ${w.temp}, dew point ${w.dew}`,
    `QNH ${w.qnh}`,
    w.trend === "NOSIG" ? "No significant change" : w.trend === "BECMG" ? "Becoming" : "Temporary changes expected",
    `Acknowledge information ${NATO[w.info]} on first contact`,
  ];
  return parts.join(". ") + ".";
}

export interface WeatherQuestion {
  id: string;
  q_pt: string;
  q_en: string;
  /** Shown after a correct answer or on reveal. */
  answer: string;
  /** Checked with checkAnswer: every key must be present. */
  keys: string[];
}

/**
 * One key for two numbers said together ("18 11", "8/3", "8, 3"). The answer
 * normaliser joins single figures, so both numbers must sit in the same key.
 */
function pairKey(first: string[], second: string): string {
  return first.flatMap((a) => [`${a} ${second}`, `${a}, ${second}`]).join("|");
}

/** The lowest broken or overcast layer, if any. */
export const ceiling = (w: Weather) => w.clouds.find((c) => c.cover === "BKN" || c.cover === "OVC");

function questions(w: Weather): Record<string, WeatherQuestion> {
  const vis = w.cavok
    ? { a: "CAVOK: 10 km ou mais, sem nuvens abaixo de 5000 ft", k: ["cavok|10|9999"] }
    : w.visibility === 9999
      ? { a: "10 km ou mais", k: ["10|9999"] }
      : { a: `${w.visibility} m`, k: [`${w.visibility}|${w.visibility / 1000}`] };
  const ceil = ceiling(w);
  const rwNum = w.runway.replace(/[LRC]$/, "");
  const side = w.runway.slice(rwNum.length);
  return {
    qnh: { id: "qnh", q_pt: "Qual é o QNH?", q_en: "What is the QNH?", answer: `${w.qnh} hPa`, keys: [String(w.qnh)] },
    wind: {
      id: "wind",
      q_pt: "De que direção vem o vento e com que velocidade? (ex.: 240 12)",
      q_en: "Wind direction and speed? (e.g. 240 12)",
      answer: `${pad(w.windDir, 3)}° ${w.windSpeed} kt`,
      keys: [pairKey([pad(w.windDir, 3), String(w.windDir)], String(w.windSpeed))],
    },
    gust: {
      id: "gust",
      q_pt: w.gust ? "Há rajadas? Até quantos nós?" : "Há rajadas? (responde \"no\" se não houver)",
      q_en: w.gust ? "Are there gusts? Up to how many knots?" : "Any gusts? (answer \"no\" if none)",
      answer: w.gust ? `Sim, ${w.gust} kt` : "Não",
      keys: [w.gust ? String(w.gust) : "no|nao|não|none"],
    },
    vis: { id: "vis", q_pt: "Qual é a visibilidade?", q_en: "What is the visibility?", answer: vis.a, keys: vis.k },
    ceiling: {
      id: "ceiling",
      q_pt: ceil ? "A que altura está a base da primeira camada BKN ou OVC (o teto), em pés?" : "Há teto (camada BKN ou OVC)? (responde \"no\" se não houver)",
      q_en: ceil ? "Height of the first BKN or OVC layer (the ceiling), in feet?" : "Is there a ceiling (BKN or OVC)? (answer \"no\" if none)",
      answer: ceil ? `${ceil.base} ft` : "Não há teto",
      keys: [ceil ? String(ceil.base) : "no|nao|não|none|cavok"],
    },
    temp: {
      id: "temp",
      q_pt: "Qual é a temperatura e o ponto de orvalho? (ex.: 18 11)",
      q_en: "Temperature and dew point? (e.g. 18 11)",
      answer: `${w.temp} °C / ${w.dew} °C`,
      keys: [pairKey([String(w.temp)], String(w.dew))],
    },
    time: {
      id: "time",
      q_pt: "A que horas (UTC) foi feita a observação?",
      q_en: "At what time (UTC) was the observation made?",
      answer: `${w.time} UTC`,
      keys: [w.time],
    },
    info: {
      id: "info",
      q_pt: "Que letra tem esta informação ATIS?",
      q_en: "Which ATIS information letter is this?",
      answer: `${w.info} (${NATO[w.info]})`,
      keys: [w.info.toLowerCase()],
    },
    runway: {
      id: "runway",
      q_pt: "Que pista está em uso?",
      q_en: "Which runway is in use?",
      answer: `${w.runway}`,
      keys: [`${rwNum}${side}|${Number(rwNum)}${side}`],
    },
    contact: {
      id: "contact",
      q_pt: "Na primeira chamada à torre, o que dizes para confirmar que ouviste o ATIS?",
      q_en: "On first contact, what do you say to confirm you have the ATIS?",
      answer: `Information ${NATO[w.info]}`,
      keys: ["information", w.info.toLowerCase()],
    },
  };
}

/** METAR decode: the code is on screen. */
export function metarQuestions(w: Weather): WeatherQuestion[] {
  const q = questions(w);
  return [q.time, q.wind, q.gust, q.vis, q.ceiling, q.temp, q.qnh];
}

/** ATIS: listen to the broadcast, then answer. */
export function atisQuestions(w: Weather): WeatherQuestion[] {
  const q = questions(w);
  return [q.info, q.runway, q.wind, q.vis, q.qnh, q.contact];
}

/** Drops units and filler words so "020° 15 kt", "5°C / 3°C" or "1016 hPa" read as plain numbers. */
export function cleanWeatherAnswer(answer: string): string {
  return answer
    .replace(/°\s*c?\b/gi, " ")
    .replace(/(\d)\s*(z|kt|kts|ft|m|km|hpa)\b/gi, "$1 ")
    .replace(/\b(degrees|degree|knots|knot|feet|foot|metres|meters|kilometres|kilometers|hpa|utc|at|and|e|from|de|graus|nós|pés)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

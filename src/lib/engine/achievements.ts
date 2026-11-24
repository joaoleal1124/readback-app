/** Daily streak and achievements, worked out from a small activity record kept per student. */
import { addDays } from "./srs";
import type { Simulation } from "./types";

export interface Stats {
  /** Days with any training, YYYY-MM-DD, oldest first. */
  days: string[];
  levelsDone: number;
  perfectLevels: number;
  voiceLevels: number;
  emergencyLevels: number;
  examsPassed: number;
  examBest: number;
  alphabetBest: number;
  weatherRuns: number;
  reviews: number;
}

export const EMPTY_STATS: Stats = {
  days: [],
  levelsDone: 0,
  perfectLevels: 0,
  voiceLevels: 0,
  emergencyLevels: 0,
  examsPassed: 0,
  examBest: 0,
  alphabetBest: 0,
  weatherRuns: 0,
  reviews: 0,
};

export type Activity =
  | { kind: "level"; simId: string; level: number; errors: number }
  | { kind: "exam"; score: number; passed: boolean }
  | { kind: "alphabet"; right: number }
  | { kind: "weather" }
  | { kind: "review" };

/** Adds one finished activity on the given day. */
export function record(s: Stats, a: Activity, today: string): Stats {
  const days = s.days.includes(today) ? s.days : [...s.days, today].slice(-400);
  const n = { ...s, days };
  switch (a.kind) {
    case "level":
      n.levelsDone++;
      if (a.errors === 0) n.perfectLevels++;
      if (a.level === 3) n.voiceLevels++;
      if (a.simId.startsWith("emerg-")) n.emergencyLevels++;
      break;
    case "exam":
      if (a.passed) n.examsPassed++;
      n.examBest = Math.max(n.examBest, a.score);
      break;
    case "alphabet":
      n.alphabetBest = Math.max(n.alphabetBest, a.right);
      break;
    case "weather":
      n.weatherRuns++;
      break;
    case "review":
      n.reviews++;
      break;
  }
  return n;
}

/** Consecutive training days ending today, or yesterday if today has no training yet. */
export function streak(days: string[], today: string): number {
  const set = new Set(days);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function bestStreak(days: string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  sorted.forEach((d, i) => {
    run = i && addDays(sorted[i - 1], 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/** progress[simId][level] exists when that level was completed. */
type Done = Record<string, Record<number, unknown>>;

interface Ctx {
  stats: Stats;
  done: Done;
  sims: Simulation[];
}

const allLevels = (c: Ctx, lic: "PPL" | "ATPL") => {
  const list = c.sims.filter((s) => s.level === lic);
  return list.length > 0 && list.every((s) => [1, 2, 3].every((l) => c.done[s.id]?.[l]));
};

export interface Achievement {
  id: string;
  icon: string;
  pt: [string, string];
  en: [string, string];
  test: (c: Ctx) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-level", icon: "🛫", pt: ["Primeiro voo", "Termina um nível de uma simulação."], en: ["First flight", "Finish one level of a simulation."], test: (c) => c.stats.levelsDone >= 1 },
  { id: "three-levels", icon: "🎯", pt: ["Três em três", "Termina os três níveis de uma simulação."], en: ["Three for three", "Finish all three levels of a simulation."], test: (c) => Object.values(c.done).some((l) => [1, 2, 3].every((n) => l[n])) },
  { id: "perfect", icon: "✨", pt: ["Sem falhas", "Termina um nível sem nenhum erro."], en: ["Flawless", "Finish a level without a single error."], test: (c) => c.stats.perfectLevels >= 1 },
  { id: "voice", icon: "🎙️", pt: ["Na rádio", "Termina um nível de voz."], en: ["On the air", "Finish a voice level."], test: (c) => c.stats.voiceLevels >= 1 },
  { id: "emergency", icon: "🚨", pt: ["Sangue-frio", "Termina um nível de uma simulação de emergência."], en: ["Cool head", "Finish a level of an emergency simulation."], test: (c) => c.stats.emergencyLevels >= 1 },
  { id: "all-ppl", icon: "🧭", pt: ["Piloto privado", "Todos os níveis de todas as simulações PPL."], en: ["Private pilot", "Every level of every PPL simulation."], test: (c) => allLevels(c, "PPL") },
  { id: "all-atpl", icon: "✈️", pt: ["Comandante", "Todos os níveis de todas as simulações ATPL."], en: ["Captain", "Every level of every ATPL simulation."], test: (c) => allLevels(c, "ATPL") },
  { id: "exam-pass", icon: "📝", pt: ["Aprovado", "Passa num exame (75% ou mais)."], en: ["Passed", "Pass an exam (75% or more)."], test: (c) => c.stats.examsPassed >= 1 },
  { id: "exam-ace", icon: "🏆", pt: ["Nota máxima", "Tira 100% num exame."], en: ["Top marks", "Score 100% in an exam."], test: (c) => c.stats.examBest >= 100 },
  { id: "alphabet", icon: "🔤", pt: ["Alfa a Zulu", "Acerta as 12 rondas do alfabeto à primeira."], en: ["Alfa to Zulu", "Get all 12 alphabet rounds right first time."], test: (c) => c.stats.alphabetBest >= 12 },
  { id: "weather", icon: "🌦️", pt: ["Meteorologista", "Faz 10 treinos de METAR ou ATIS."], en: ["Weather wise", "Do 10 METAR or ATIS drills."], test: (c) => c.stats.weatherRuns >= 10 },
  { id: "reviews", icon: "🧠", pt: ["Não esqueço", "Revê 25 erros."], en: ["Never forget", "Review 25 mistakes."], test: (c) => c.stats.reviews >= 25 },
  { id: "streak-3", icon: "🔥", pt: ["Em ritmo", "Treina 3 dias seguidos."], en: ["On a roll", "Train 3 days in a row."], test: (c) => bestStreak(c.stats.days) >= 3 },
  { id: "streak-7", icon: "📅", pt: ["Uma semana", "Treina 7 dias seguidos."], en: ["One week", "Train 7 days in a row."], test: (c) => bestStreak(c.stats.days) >= 7 },
  { id: "streak-30", icon: "🥇", pt: ["Um mês", "Treina 30 dias seguidos."], en: ["One month", "Train 30 days in a row."], test: (c) => bestStreak(c.stats.days) >= 30 },
];

export const unlocked = (c: Ctx) => new Set(ACHIEVEMENTS.filter((a) => a.test(c)).map((a) => a.id));

const KEY = "readback-stats-v1";

export function loadStats(): Stats {
  try {
    return { ...EMPTY_STATS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Stats>) };
  } catch {
    return EMPTY_STATS;
  }
}

export function saveStats(s: Stats): Stats {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
  return s;
}

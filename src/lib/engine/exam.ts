import { isQuiz, type Licence, type Simulation, type Step } from "./types";

export interface ExamItem {
  sim: Simulation;
  step: Step;
}

export const EXAM_SIZE = 20;
export const SECONDS_PER_ITEM = 45;
/** EASA theory exams pass at 75%. */
export const PASS_MARK = 75;

type Rand = () => number;

/** Random steps from every simulation of the licence, spread across simulations, mixed. */
export function buildExam(sims: Simulation[], licence: Licence, size = EXAM_SIZE, r: Rand = Math.random): ExamItem[] {
  const pool = sims.filter((s) => s.level === licence);
  const shuffled = <T,>(a: T[]) => a.map((x) => [r(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
  const perSim = Math.ceil(size / Math.max(1, pool.length)) + 2;
  const picked: ExamItem[] = [];
  for (const sim of shuffled(pool)) {
    for (const step of shuffled(sim.steps).slice(0, perSim)) picked.push({ sim, step });
  }
  // keep a mix: about a quarter theory, the rest radio exchanges
  const radio = shuffled(picked.filter((i) => !isQuiz(i.step)));
  const theory = shuffled(picked.filter((i) => isQuiz(i.step)));
  const nTheory = Math.min(theory.length, Math.round(size / 4));
  return shuffled([...theory.slice(0, nTheory), ...radio.slice(0, size - nTheory)]).slice(0, size);
}

export const examScore = (right: number, total: number) => (total ? Math.round((right / total) * 100) : 0);
export const passed = (score: number) => score >= PASS_MARK;

export interface ExamRecord {
  date: string; // ISO
  licence: Licence;
  score: number;
  right: number;
  total: number;
  seconds: number;
}

const KEY = "readback-exams";

export function loadExams(): ExamRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as ExamRecord[];
  } catch {
    return [];
  }
}

export function saveExam(rec: ExamRecord): ExamRecord[] {
  const all = [rec, ...loadExams()].slice(0, 50);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
  return all;
}

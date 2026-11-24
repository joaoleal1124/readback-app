"use client";
import { getBrowserSupabase } from "@/lib/supabase/client";

export interface LevelResult {
  best: number;
  runs: number;
}
/** progress[simId][level] */
export type Progress = Record<string, Record<number, LevelResult>>;

const LOCAL_KEY = "readback-progress-v1";

function readLocal(): Progress {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "{}") as Progress;
  } catch {
    return {};
  }
}

/** Loads progress from Supabase when signed in, otherwise from this browser (demo mode). */
export async function loadProgress(): Promise<Progress> {
  const supabase = getBrowserSupabase();
  if (!supabase) return readLocal();
  const { data, error } = await supabase.from("progress").select("sim_id, level, best_errors, runs");
  if (error || !data) return {};
  const p: Progress = {};
  for (const r of data as { sim_id: string; level: number; best_errors: number; runs: number }[]) {
    (p[r.sim_id] ??= {})[r.level] = { best: r.best_errors, runs: r.runs };
  }
  return p;
}

/** Records a finished level, keeping the best (lowest) error count. */
export async function saveResult(current: Progress, simId: string, level: number, errors: number): Promise<Progress> {
  const old = current[simId]?.[level];
  const result: LevelResult = { best: Math.min(old?.best ?? Infinity, errors), runs: (old?.runs ?? 0) + 1 };
  const next: Progress = { ...current, [simId]: { ...current[simId], [level]: result } };
  const supabase = getBrowserSupabase();
  if (!supabase) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: progress lives for this visit only */
    }
    return next;
  }
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    await supabase.from("progress").upsert({
      user_id: auth.user.id,
      sim_id: simId,
      level,
      best_errors: result.best,
      runs: result.runs,
      updated_at: new Date().toISOString(),
    });
  }
  return next;
}

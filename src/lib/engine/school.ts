import type { Licence, Simulation } from "./types";

export interface LicenceProgress {
  done: number;
  total: number;
  pct: number;
}

/** Turns "simId:level" entries into completed levels per licence. Unknown simulations are ignored. */
export function licenceProgress(done: string[], sims: Simulation[]): Record<Licence, LicenceProgress> {
  const level = new Map(sims.map((s) => [s.id, s.level]));
  const out: Record<Licence, LicenceProgress> = {
    PPL: { done: 0, total: 0, pct: 0 },
    ATPL: { done: 0, total: 0, pct: 0 },
  };
  for (const s of sims) out[s.level].total += 3;
  for (const d of new Set(done)) {
    const [simId, lv] = d.split(":");
    const lic = level.get(simId);
    if (lic && ["1", "2", "3"].includes(lv)) out[lic].done++;
  }
  for (const k of ["PPL", "ATPL"] as const) out[k].pct = out[k].total ? Math.round((out[k].done / out[k].total) * 100) : 0;
  return out;
}

/** Whole days since a date, for "last active". */
export function daysSince(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
}

export const JOIN_CODE = /^[A-Z2-9]{6}$/;
export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

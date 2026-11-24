import "server-only";
import sims from "@/server/content/sims.json";
import type { Simulation } from "@/lib/engine/types";

const STEPS = new Map((sims as Simulation[]).map((s) => [s.id, s.steps.length]));

export interface ResultInput {
  simId: string;
  level: number;
  errors: number;
}

/** Checks a finished-level report against the real content before it is stored. */
export function validateResult(body: unknown): { ok: true; value: ResultInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "bad_body" };
  const { simId, level, errors } = body as Record<string, unknown>;
  if (typeof simId !== "string" || !STEPS.has(simId)) return { ok: false, error: "unknown_sim" };
  if (!Number.isInteger(level) || (level as number) < 1 || (level as number) > 3) return { ok: false, error: "bad_level" };
  if (!Number.isInteger(errors) || (errors as number) < 0 || (errors as number) > STEPS.get(simId)!)
    return { ok: false, error: "bad_errors" };
  return { ok: true, value: { simId, level: level as number, errors: errors as number } };
}

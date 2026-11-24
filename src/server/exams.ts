import "server-only";

export interface ExamInput {
  licence: "PPL" | "ATPL";
  right: number;
  total: number;
  seconds: number;
}

/** Checks a finished exam before it is stored (the database checks it again). */
export function validateExam(body: unknown): { ok: true; value: ExamInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "bad_body" };
  const { licence, right, total, seconds } = body as Record<string, unknown>;
  if (licence !== "PPL" && licence !== "ATPL") return { ok: false, error: "bad_licence" };
  if (!Number.isInteger(total) || (total as number) < 1 || (total as number) > 50) return { ok: false, error: "bad_total" };
  if (!Number.isInteger(right) || (right as number) < 0 || (right as number) > (total as number))
    return { ok: false, error: "bad_right" };
  if (!Number.isInteger(seconds) || (seconds as number) < 0 || (seconds as number) > 7200) return { ok: false, error: "bad_seconds" };
  return { ok: true, value: { licence, right: right as number, total: total as number, seconds: seconds as number } };
}

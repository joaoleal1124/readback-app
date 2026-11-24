import { NextResponse, connection, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/security/rateLimit";
import { validateResult } from "@/server/progress";

/**
 * Stores a finished level. The browser can no longer write the progress table
 * directly: this route checks the simulation, level and error count against the
 * real content, and the database function keeps the best score and counts runs.
 */
export async function POST(request: NextRequest) {
  await connection();
  const ip = rateLimit(`progress:ip:${clientIp(request.headers)}`, 60, 60_000);
  if (!ip.ok) return json({ error: "rate_limited" }, 429, ip.retryAfter);

  const supabase = await getServerSupabase();
  if (!supabase) return json({ error: "demo_mode" }, 409);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: "unauthorized" }, 401);
  const user = rateLimit(`progress:user:${auth.user.id}`, 30, 60_000);
  if (!user.ok) return json({ error: "rate_limited" }, 429, user.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_body" }, 400);
  }
  const check = validateResult(body);
  if (!check.ok) return json({ error: check.error }, 400);

  const { simId, level, errors } = check.value;
  const { data, error } = await supabase.rpc("record_progress", { p_sim_id: simId, p_level: level, p_errors: errors });
  if (error) return json({ error: "save_failed" }, 500);
  const row = (Array.isArray(data) ? data[0] : data) as { best_errors: number; runs: number } | null;
  return json({ best: row?.best_errors ?? errors, runs: row?.runs ?? 1 }, 200);
}

function json(body: unknown, status: number, retryAfter?: number) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (retryAfter) headers["Retry-After"] = String(retryAfter);
  return NextResponse.json(body, { status, headers });
}

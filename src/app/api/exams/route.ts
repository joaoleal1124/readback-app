import { NextResponse, connection, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/security/rateLimit";
import { validateExam } from "@/server/exams";

/** Stores a finished exam for the signed-in student, so their instructor can see it. */
export async function POST(request: NextRequest) {
  await connection();
  const ip = rateLimit(`exams:ip:${clientIp(request.headers)}`, 20, 60_000);
  if (!ip.ok) return json({ error: "rate_limited" }, 429, ip.retryAfter);

  const supabase = await getServerSupabase();
  if (!supabase) return json({ error: "demo_mode" }, 409);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: "unauthorized" }, 401);
  const user = rateLimit(`exams:user:${auth.user.id}`, 6, 60_000);
  if (!user.ok) return json({ error: "rate_limited" }, 429, user.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_body" }, 400);
  }
  const check = validateExam(body);
  if (!check.ok) return json({ error: check.error }, 400);

  const { licence, right, total, seconds } = check.value;
  const { error } = await supabase.rpc("record_exam", {
    p_licence: licence,
    p_right: right,
    p_total: total,
    p_seconds: seconds,
  });
  if (error) return json({ error: "save_failed" }, 500);
  return json({ ok: true }, 200);
}

function json(body: unknown, status: number, retryAfter?: number) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (retryAfter) headers["Retry-After"] = String(retryAfter);
  return NextResponse.json(body, { status, headers });
}

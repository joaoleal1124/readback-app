import { NextResponse, connection, type NextRequest } from "next/server";
import { currentUserId } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/security/rateLimit";
import sims from "@/server/content/sims.json";

/**
 * Training content is served only to signed-in students, so the paid material
 * never ships in the public JavaScript bundle. Subscription checks go here later.
 * Rate limited so nobody can scrape it in bulk.
 */
export async function GET(request: NextRequest) {
  // always answer at request time: this route must never be prerendered into a public static file
  await connection();
  const ip = rateLimit(`sims:ip:${clientIp(request.headers)}`, 60, 60_000);
  if (!ip.ok) return tooMany(ip.retryAfter);
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = rateLimit(`sims:user:${userId}`, 20, 60_000);
  if (!user.ok) return tooMany(user.retryAfter);
  return NextResponse.json(sims, { headers: { "Cache-Control": "private, no-store" } });
}

function tooMany(retryAfter: number) {
  return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
}

import { NextResponse, connection } from "next/server";
import { currentUserId } from "@/lib/supabase/server";
import sims from "@/server/content/sims.json";

/**
 * Training content is served only to signed-in students, so the paid material
 * never ships in the public JavaScript bundle. Subscription checks go here later.
 */
export async function GET() {
  // always answer at request time: this route must never be prerendered into a public static file
  await connection();
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(sims, { headers: { "Cache-Control": "private, no-store" } });
}

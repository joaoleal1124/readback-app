import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/** Supabase client for route handlers, acting as the signed-in user. Null in demo mode. */
export async function getServerSupabase() {
  if (!isSupabaseConfigured()) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) store.set(name, value, options);
      },
    },
  });
}

/** The verified user id, or null when signed out. In demo mode returns "demo". */
export async function currentUserId(): Promise<string | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return "demo";
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

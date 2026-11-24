"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { LanguageSwitch, useI18n } from "@/lib/i18n/provider";

export default function SiteHeader() {
  const { t } = useI18n();
  const supabase = getBrowserSupabase();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setEmail(session?.user?.email ?? null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  return (
    <>
      <header className="site-header">
        <Link href="/" className="brand">
          Read<span>back</span>
        </Link>
        <div className="head-actions">
          <LanguageSwitch />
          {supabase &&
            (email ? (
              <form action="/auth/signout" method="post">
                <button className="btn" type="submit" title={email}>
                  {t.logout}
                </button>
              </form>
            ) : (
              <Link className="btn" href="/login">
                {t.login}
              </Link>
            ))}
        </div>
      </header>
      {!supabase && <p className="banner">{t.demo}</p>}
    </>
  );
}

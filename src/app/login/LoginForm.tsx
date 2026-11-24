"use client";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/provider";

export default function LoginForm() {
  const { t } = useI18n();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    params.get("error") ? "error" : "idle",
  );
  const [message, setMessage] = useState(params.get("error") ? t.linkError : "");
  const supabase = getBrowserSupabase();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setState("sending");
    const next = params.get("next") ?? "/treino";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setState("error");
      setMessage(error.message);
    } else {
      setState("sent");
      setMessage(t.linkSent);
    }
  };

  return (
    <section className="card">
      <h2>{t.loginTitle}</h2>
      {supabase ? (
        <>
          <p className="sub">{t.loginBody}</p>
          <form className="view" onSubmit={submit}>
            <label className="lbl" htmlFor="email">
              {t.emailLabel}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn primary" type="submit" disabled={state === "sending"}>
              {t.sendLink}
            </button>
          </form>
          {message && <p className={state === "error" ? "note score bad" : "note"}>{message}</p>}
        </>
      ) : (
        <p className="sub">{t.demo}</p>
      )}
    </section>
  );
}

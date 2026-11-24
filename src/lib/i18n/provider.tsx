"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DICTS, LANGS, type Dict, type Lang } from "./dict";

const KEY = "readback-lang";
const Ctx = createContext<{ lang: Lang; t: Dict; setLang: (l: Lang) => void }>({
  lang: "pt",
  t: DICTS.pt,
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("pt");
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {}
    const guess = saved ?? (navigator.language?.toLowerCase().startsWith("pt") ? "pt" : "en");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- language is only known in the browser
    if ((LANGS as readonly string[]).includes(guess)) setLangState(guess as Lang);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {}
  }, []);
  return <Ctx.Provider value={{ lang, t: DICTS[lang], setLang }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

export function LanguageSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div className="seg" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { checkSpoken, makeSession, type DrillItem } from "@/lib/engine/phonetic";
import { useI18n } from "@/lib/i18n/provider";
import type { useAtcVoice } from "./useAtcVoice";

const BEST_KEY = "readback-alphabet-best";

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

type Fb = { ok: boolean; figures?: boolean; revealed?: boolean };

/** NATO alphabet and ICAO numbers: 12 quick rounds, you only move on with the right answer. */
export default function AlphabetGame({ voice }: { voice: ReturnType<typeof useAtcVoice> }) {
  const { t } = useI18n();
  const [items, setItems] = useState<DrillItem[]>(() => makeSession());
  const [i, setI] = useState(0);
  const [firstTry, setFirstTry] = useState(0);
  const [tried, setTried] = useState(false);
  const [solved, setSolved] = useState(false);
  const [fb, setFb] = useState<Fb | null>(null);
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState<string[]>([]);
  const [best, setBest] = useState(readBest);
  const [finished, setFinished] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const item = items[i];
  const typed = !item.options;

  useEffect(() => {
    if (item.kind === "hear") {
      const id = setTimeout(() => voice.speak(item.prompt, "en-GB", false), 250);
      return () => clearTimeout(id);
    }
    if (typed) inputRef.current?.focus();
    // a new round only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, items]);

  const mark = (ok: boolean, figures = false) => {
    setFb({ ok, figures });
    if (ok) {
      setSolved(true);
      if (!tried) setFirstTry((n) => n + 1);
      setTimeout(() => nextRef.current?.focus(), 30);
    } else setTried(true);
  };

  const choose = (o: string) => {
    if (solved) return;
    if (o === item.spoken) mark(true);
    else {
      setWrong((w) => [...w, o]);
      mark(false);
    }
  };

  const check = () => {
    if (solved || !answer.trim()) return;
    const r = checkSpoken(answer, item.spoken);
    mark(r.ok, r.usedFigures);
  };

  const next = () => {
    if (!solved) return;
    if (i < items.length - 1) {
      setI(i + 1);
      setTried(false);
      setSolved(false);
      setFb(null);
      setAnswer("");
      setWrong([]);
      return;
    }
    setFinished(true);
    setNewBest(firstTry > best);
    if (firstTry > best) {
      setBest(firstTry);
      try {
        localStorage.setItem(BEST_KEY, String(firstTry));
      } catch {}
    }
  };

  const restart = () => {
    setItems(makeSession());
    setI(0);
    setFirstTry(0);
    setTried(false);
    setSolved(false);
    setFb(null);
    setAnswer("");
    setWrong([]);
    setFinished(false);
  };

  if (finished)
    return (
      <section className="view">
        <div className="card">
          <div className="lbl">{t.abcDone}</div>
          <div className="big-num">
            {firstTry}/{items.length}
          </div>
          <div className="sub">{t.firstTry}</div>
          <p className="note">{newBest ? t.abcNewBest : t.abcBest(best)}</p>
          <div className="row">
            <button className="btn primary" onClick={restart}>
              {t.abcAgain}
            </button>
          </div>
        </div>
      </section>
    );

  return (
    <section className="view">
      <p className="sub">{t.abcIntro}</p>
      <div className="topbar">
        <span className="steps">{t.stepOf(i + 1, items.length)}</span>
        <span className="steps">{t.abcBest(best)}</span>
      </div>
      <div className="bar">
        <i style={{ width: `${(i / items.length) * 100}%` }} />
      </div>

      <div className="card">
        <div className="lbl">{t.abcAsk[item.kind]}</div>
        {item.kind === "hear" ? (
          <div className="row">
            <button className="btn primary" onClick={() => voice.speak(item.prompt, "en-GB", false)} disabled={!voice.supported}>
              {t.listen}
            </button>
            {(!voice.supported || solved) && <span className="msg">{item.prompt}</span>}
          </div>
        ) : (
          <p className="drill-prompt">{item.prompt}</p>
        )}

        {item.options ? (
          <div className="drill-opts">
            {item.options.map((o) => (
              <button
                key={o}
                className={`opt ${solved && o === item.spoken ? "right" : ""} ${wrong.includes(o) ? "wrong" : ""}`}
                disabled={wrong.includes(o)}
                onClick={() => choose(o)}
              >
                {o}
              </button>
            ))}
          </div>
        ) : (
          <input
            ref={inputRef}
            className="drill-input"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (solved) next();
                else check();
              }
            }}
            placeholder={t.abcPh}
            aria-label={t.yourAnswer}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            readOnly={solved}
          />
        )}

        <div className="row">
          {typed && (
            <button className="btn primary" onClick={check} disabled={solved}>
              {t.check}
            </button>
          )}
          <button className="btn" ref={nextRef} onClick={next} disabled={!solved}>
            {t.next}
          </button>
        </div>
      </div>

      {fb && (
        <div className={`fb ${fb.ok ? "good" : "badfb"}`}>
          <div className={`score ${fb.ok ? "ok" : "bad"}`}>{fb.ok ? t.correct : t.notYet}</div>
          {!fb.ok && fb.figures && <p className="note">{t.abcWords}</p>}
          {!fb.ok && !fb.revealed && (
            <div className="row">
              <button className="btn" onClick={() => setFb({ ...fb, revealed: true })}>
                {t.reveal}
              </button>
            </div>
          )}
          {(fb.ok || fb.revealed) && (
            <>
              <p className="msg">{item.kind === "hear" ? `${item.spoken} = ${item.prompt}` : item.spoken}</p>
              {item.kind !== "hear" && (
                <div className="row">
                  <button className="btn" onClick={() => voice.speak(item.spoken, "en-GB", true)} disabled={!voice.supported}>
                    {t.abcHear}
                  </button>
                </div>
              )}
              {!fb.ok && <p className="note">{typed ? t.nowDo.write : t.nowDo.choose}</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}

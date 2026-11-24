"use client";
import { useEffect, useRef, useState } from "react";
import { checkAnswer } from "@/lib/engine/normalize";
import { atisQuestions, cleanWeatherAnswer, makeWeather, metarQuestions, toAtis, toMetar, type Weather } from "@/lib/engine/weather";
import { useI18n } from "@/lib/i18n/provider";
import type { useAtcVoice } from "./useAtcVoice";

type Mode = "metar" | "atis";

/** ATIS voices use the accent of the airport's country. */
const ACCENT_BY_PREFIX: Record<string, string> = {
  LP: "pt-PT", LE: "es-ES", LF: "fr-FR", ED: "de-DE", LI: "it-IT", EG: "en-GB", OM: "en-IN",
};

interface Session {
  mode: Mode;
  weather: Weather;
  index: number;
  firstTry: number;
  finished: boolean;
}

const newSession = (mode: Mode): Session => ({ mode, weather: makeWeather(), index: 0, firstTry: 0, finished: false });

/** Read a METAR or listen to an ATIS, then answer questions about it. */
export default function WeatherDrill({ voice, onDone }: { voice: ReturnType<typeof useAtcVoice>; onDone?: () => void }) {
  const { t, lang } = useI18n();
  const [s, setS] = useState<Session>(() => newSession("metar"));
  const [answer, setAnswer] = useState("");
  const [tried, setTried] = useState(false);
  const [solved, setSolved] = useState(false);
  const [fb, setFb] = useState<{ ok: boolean; revealed?: boolean } | null>(null);
  const [showText, setShowText] = useState(false);
  const [slow, setSlow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const w = s.weather;
  const qs = s.mode === "metar" ? metarQuestions(w) : atisQuestions(w);
  const q = qs[s.index];
  const atis = toAtis(w);
  const accent = ACCENT_BY_PREFIX[w.airport.icao.slice(0, 2)] ?? "en-GB";

  const reset = () => {
    setAnswer("");
    setTried(false);
    setSolved(false);
    setFb(null);
  };

  const begin = (mode: Mode) => {
    voice.stop();
    setS(newSession(mode));
    setShowText(false);
    reset();
  };

  useEffect(() => {
    if (!s.finished) inputRef.current?.focus();
  }, [s.index, s.weather, s.finished]);

  const check = () => {
    if (solved || !answer.trim()) return;
    const ok = checkAnswer(cleanWeatherAnswer(answer), q.keys, "").ok;
    setFb({ ok });
    if (ok) {
      setSolved(true);
      if (!tried) setS((x) => ({ ...x, firstTry: x.firstTry + 1 }));
      setTimeout(() => nextRef.current?.focus(), 30);
    } else setTried(true);
  };

  const next = () => {
    if (!solved) return;
    if (s.index < qs.length - 1) setS((x) => ({ ...x, index: x.index + 1 }));
    else {
      onDone?.();
      setS((x) => ({ ...x, finished: true }));
      setShowText(true);
    }
    reset();
  };

  return (
    <section className="view">
      <div className="seg" role="group" aria-label={t.wxMode}>
        {(["metar", "atis"] as const).map((m) => (
          <button key={m} aria-pressed={s.mode === m} onClick={() => begin(m)}>
            {m === "metar" ? t.wxMetar : t.wxAtis}
          </button>
        ))}
      </div>
      <p className="sub">{s.mode === "metar" ? t.wxMetarIntro : t.wxAtisIntro}</p>

      <div className="card">
        <div className="lbl">
          {w.airport.name} ({w.airport.icao})
        </div>
        {s.mode === "metar" ? (
          <p className="metar">{toMetar(w)}</p>
        ) : (
          <>
            <div className="row">
              <button className="btn primary" onClick={() => voice.speak(atis, accent, slow)} disabled={!voice.supported}>
                {t.listen}
              </button>
              <button className="btn" aria-pressed={slow} onClick={() => setSlow((x) => !x)}>
                {slow ? t.normalSpeed : t.slower}
              </button>
              <button className="btn" onClick={() => setShowText((x) => !x)}>
                {showText ? t.hideText : t.showText}
              </button>
            </div>
            {showText || !voice.supported ? <p className="msg">{atis}</p> : <p className="hiddenmsg">· · · · · · · ·</p>}
          </>
        )}
      </div>

      {s.finished ? (
        <div className="card">
          <div className="lbl">{t.wxDone}</div>
          <div className="big-num">
            {s.firstTry}/{qs.length}
          </div>
          <div className="sub">{t.firstTry}</div>
          <div className="row">
            <button className="btn primary" onClick={() => begin(s.mode)}>
              {t.wxNew}
            </button>
            <button className="btn" onClick={() => begin(s.mode === "metar" ? "atis" : "metar")}>
              {s.mode === "metar" ? t.wxAtis : t.wxMetar}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="topbar">
            <span className="steps">{t.stepOf(s.index + 1, qs.length)}</span>
          </div>
          <div className="card">
            <label className="lbl" htmlFor="wx-answer">
              {t.question}
            </label>
            <p className="q">{lang === "pt" ? q.q_pt : q.q_en}</p>
            <input
              id="wx-answer"
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
              placeholder={t.phQuiz}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              readOnly={solved}
            />
            <div className="row">
              <button className="btn primary" onClick={check} disabled={solved}>
                {t.check}
              </button>
              <button className="btn" ref={nextRef} onClick={next} disabled={!solved}>
                {t.next}
              </button>
            </div>
          </div>
          {fb && (
            <div className={`fb ${fb.ok ? "good" : "badfb"}`}>
              <div className={`score ${fb.ok ? "ok" : "bad"}`}>{fb.ok ? t.correct : t.notYet}</div>
              {!fb.ok && !fb.revealed && (
                <>
                  <p className="note">{t.tryAgain}</p>
                  <div className="row">
                    <button className="btn" onClick={() => setFb({ ...fb, revealed: true })}>
                      {t.reveal}
                    </button>
                  </div>
                </>
              )}
              {(fb.ok || fb.revealed) && (
                <>
                  <p className="msg">{q.answer}</p>
                  {!fb.ok && <p className="note">{t.nowDo.write}</p>}
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

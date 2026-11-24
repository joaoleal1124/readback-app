"use client";
import { useMemo, useRef, useState } from "react";
import { newCallsign } from "@/lib/engine/callsign";
import { checkAnswer, fillCallsign } from "@/lib/engine/normalize";
import { LAST_BOX, dayKey, dueCards, type Deck } from "@/lib/engine/srs";
import { isQuiz, type Simulation, type Step } from "@/lib/engine/types";
import { useI18n } from "@/lib/i18n/provider";
import type { useAtcVoice } from "./useAtcVoice";

interface Found {
  sim: Simulation;
  step: Step;
}

/** Reviews the steps you got wrong, spaced out so they stick. */
export default function MistakesReview(props: {
  sims: Simulation[];
  deck: Deck;
  onReviewed: (stepId: string, rightFirstTime: boolean) => void;
  accentFor: (sim: Simulation) => string;
  voice: ReturnType<typeof useAtcVoice>;
}) {
  const { t } = useI18n();
  const { voice, deck } = props;
  const byId = useMemo(() => {
    const m = new Map<string, Found>();
    for (const sim of props.sims) for (const step of sim.steps) m.set(step.id, { sim, step });
    return m;
  }, [props.sims]);

  const [queue, setQueue] = useState<string[] | null>(null);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState("");
  const [tried, setTried] = useState(false);
  const [solved, setSolved] = useState(false);
  const [fb, setFb] = useState<{ ok: boolean; missing?: string[]; revealed?: boolean } | null>(null);
  const [showText, setShowText] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  const today = dayKey(new Date());
  const due = dueCards(deck, today).filter((id) => byId.has(id));
  const total = Object.keys(deck).filter((id) => byId.has(id)).length;

  const start = () => {
    setQueue(due);
    setI(0);
    setScore(0);
    reset();
  };
  const reset = () => {
    setAnswer("");
    setTried(false);
    setSolved(false);
    setFb(null);
    setShowText(false);
  };

  const id = queue?.[i];
  const found = id ? byId.get(id) : undefined;
  const cs = useMemo(() => (found ? newCallsign(found.sim.level) : ""), [found]);

  if (!queue || !found)
    return (
      <section className="view">
        <p className="sub">{t.srsIntro}</p>
        {queue && queue.length > 0 && (
          <div className="card">
            <div className="lbl">{t.srsDone}</div>
            <div className="big-num">
              {score}/{queue.length}
            </div>
            <div className="sub">{t.firstTry}</div>
          </div>
        )}
        <div className="card">
          <div className="big-num">{due.length}</div>
          <div className="sub">{t.srsDue(total)}</div>
          <div className="row">
            <button className="btn primary" onClick={start} disabled={!due.length}>
              {t.srsStart}
            </button>
          </div>
          {!total && <p className="note">{t.srsEmpty}</p>}
        </div>
      </section>
    );

  const { sim, step } = found;
  const card = deck[step.id];
  const reference = fillCallsign(isQuiz(step) ? step.answer : step.readback, cs);

  const check = () => {
    if (solved || !answer.trim()) return;
    const r = checkAnswer(answer, step.keys, cs);
    setFb({ ok: r.ok, missing: r.results.filter((x) => !x.ok).map((x) => x.label) });
    if (r.ok) {
      setSolved(true);
      setShowText(true);
      if (!tried) setScore((n) => n + 1);
      props.onReviewed(step.id, !tried);
      setTimeout(() => nextRef.current?.focus(), 30);
    } else setTried(true);
  };

  const next = () => {
    if (!solved) return;
    setI((n) => n + 1);
    reset();
  };

  return (
    <section className="view">
      <div className="topbar">
        <span className="steps">{t.stepOf(i + 1, queue.length)}</span>
        {card && <span className="steps">{t.srsBox(card.box, LAST_BOX)}</span>}
      </div>
      <div className="bar">
        <i style={{ width: `${(i / queue.length) * 100}%` }} />
      </div>
      <p className="sub">
        {sim.title} · {step.phase}
      </p>
      <p className="cs">
        {t.yourCallsign}: <b>{cs}</b>
      </p>
      <div className="card">
        {isQuiz(step) ? (
          <p className="q">{step.q_pt}</p>
        ) : (
          <>
            <p className="ctx">{step.context_pt}</p>
            <div className="row">
              <button
                className="btn primary"
                onClick={() => voice.speak(fillCallsign(step.atc, cs), props.accentFor(sim), false)}
                disabled={!voice.supported}
              >
                {t.listen}
              </button>
              <button className="btn" onClick={() => setShowText((x) => !x)}>
                {showText ? t.hideText : t.showText}
              </button>
            </div>
            {(showText || !voice.supported) && <p className="msg">{fillCallsign(step.atc, cs)}</p>}
          </>
        )}
      </div>
      <div className="card">
        <label className="lbl" htmlFor="srs-answer">
          {isQuiz(step) ? t.yourAnswer : t.yourReadback}
        </label>
        <textarea
          id="srs-answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (solved) next();
              else check();
            }
          }}
          placeholder={isQuiz(step) ? t.phQuiz : t.phWrite}
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
          <div className={`score ${fb.ok ? "ok" : "bad"}`}>
            {fb.ok ? (tried ? t.srsAgainTomorrow : t.srsMovedUp) : t.notYet}
          </div>
          {!fb.ok && !isQuiz(step) && fb.missing && fb.missing.length > 0 && (
            <ul className="chips">
              {fb.missing.map((m) => (
                <li key={m} className="n">
                  ✗ {m}
                </li>
              ))}
            </ul>
          )}
          {!fb.ok && !fb.revealed && (
            <div className="row">
              <button className="btn" onClick={() => setFb({ ...fb, revealed: true })}>
                {t.reveal}
              </button>
            </div>
          )}
          {(fb.ok || fb.revealed) && (
            <>
              <p className="msg">{reference}</p>
              <p className="note">{step.note_pt}</p>
              {!fb.ok && <p className="note">{t.nowDo.write}</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}

"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { checkAnswer, fillCallsign, type KeyResult } from "@/lib/engine/normalize";
import { newCallsign } from "@/lib/engine/callsign";
import { LEVELS, isQuiz, type AnswerMode, type Licence, type Simulation, type Step } from "@/lib/engine/types";
import { ACCENTS } from "@/lib/i18n/dict";
import { useI18n } from "@/lib/i18n/provider";
import { loadProgress, saveResult, type Progress } from "./progress";
import { useAtcVoice } from "./useAtcVoice";
import AlphabetGame from "./AlphabetGame";
import WeatherDrill from "./WeatherDrill";
import { useSpeechInput } from "./useSpeechInput";

type View = "home" | "sim" | "review" | "alphabet" | "weather";
const PREFS_KEY = "readback-prefs";

function readPrefs(): { licence?: Licence; accent?: string } {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

interface Run {
  sim: Simulation;
  level: number;
  mode: AnswerMode;
  callsign: string;
  index: number;
  errors: number;
  firstTry: number;
  finished: boolean;
}

interface Feedback {
  ok: boolean;
  results?: KeyResult[];
  revealed?: boolean;
}

export default function Trainer() {
  const { t, lang } = useI18n();
  const [sims, setSims] = useState<Simulation[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [progress, setProgress] = useState<Progress>({});
  const [view, setView] = useState<View>("home");
  // the first render only shows "loading", so reading saved preferences here cannot cause a hydration mismatch
  const [licence, setLicence] = useState<Licence>(() => readPrefs().licence ?? "PPL");
  const [accentPref, setAccentPref] = useState(() => readPrefs().accent ?? "auto");
  const [run, setRun] = useState<Run | null>(null);
  const [reviewId, setReviewId] = useState("");

  useEffect(() => {
    fetch("/api/sims", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: Simulation[]) => setSims(d))
      .catch(() => setLoadFailed(true));
    loadProgress().then(setProgress);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ licence, accent: accentPref }));
    } catch {}
  }, [licence, accentPref]);

  const voice = useAtcVoice();

  const start = (sim: Simulation, level: number) => {
    setRun({
      sim,
      level,
      mode: LEVELS[level - 1].mode,
      callsign: newCallsign(sim.level),
      index: 0,
      errors: 0,
      firstTry: 0,
      finished: false,
    });
    setView("sim");
  };

  const finish = async (r: Run) => {
    setRun({ ...r, finished: true });
    setProgress(await saveResult(progress, r.sim.id, r.level, r.errors));
  };

  if (loadFailed) return <p className="sub">{t.loadError}</p>;
  if (!sims) return <p className="sub">{t.loading}</p>;

  return (
    <div className="view">
      {view !== "sim" && (
        <div className="tabs" role="group" aria-label={t.sims}>
          <button aria-pressed={view === "home"} onClick={() => setView("home")}>
            {t.sims}
          </button>
          <button aria-pressed={view === "alphabet"} onClick={() => setView("alphabet")}>
            {t.alphabet}
          </button>
          <button aria-pressed={view === "weather"} onClick={() => setView("weather")}>
            {t.weather}
          </button>
          <button aria-pressed={view === "review"} onClick={() => setView("review")}>
            {t.review}
          </button>
        </div>
      )}

      {view === "home" && (
        <Home
          sims={sims}
          licence={licence}
          setLicence={setLicence}
          accentPref={accentPref}
          setAccentPref={setAccentPref}
          progress={progress}
          hasVoiceFor={voice.hasVoiceFor}
          onStart={start}
        />
      )}

      {view === "sim" && run && (
        <SimRun
          key={`${run.sim.id}-${run.level}-${run.callsign}`}
          run={run}
          setRun={setRun}
          accentLang={accentPref === "auto" ? run.sim.accent : accentPref}
          voice={voice}
          onFinish={finish}
          onExit={() => {
            voice.stop();
            setView("home");
          }}
          onStart={start}
        />
      )}

      {view === "alphabet" && <AlphabetGame voice={voice} />}

      {view === "weather" && <WeatherDrill voice={voice} />}

      {view === "review" && (
        <Review sims={sims} id={reviewId || sims[0].id} setId={setReviewId} lang={lang} />
      )}
    </div>
  );
}

/* ---------------- home: simulations and levels ---------------- */

function Home(props: {
  sims: Simulation[];
  licence: Licence;
  setLicence: (l: Licence) => void;
  accentPref: string;
  setAccentPref: (a: string) => void;
  progress: Progress;
  hasVoiceFor: (lang: string) => boolean;
  onStart: (s: Simulation, level: number) => void;
}) {
  const { t, lang } = useI18n();
  const { sims, licence, progress } = props;
  const done = (id: string, n: number) => !!progress[id]?.[n];
  const open = (id: string, n: number) => n === 1 || done(id, n - 1);

  return (
    <section className="view">
      <div className="controls">
        <div className="seg" role="group" aria-label="Licence">
          {(["PPL", "ATPL"] as const).map((l) => (
            <button key={l} aria-pressed={licence === l} onClick={() => props.setLicence(l)}>
              {l === "PPL" ? "PPL · VFR" : "ATPL · IFR"}
            </button>
          ))}
        </div>
        <select
          id="accent"
          aria-label={t.accent}
          value={props.accentPref}
          onChange={(e) => props.setAccentPref(e.target.value)}
        >
          <option value="auto">{t.accentAuto}</option>
          {ACCENTS.map((a) => {
            const ok = props.hasVoiceFor(a.lang);
            return (
              <option key={a.lang} value={a.lang} disabled={!ok}>
                {t.accent}: {lang === "pt" ? a.pt : a.en}
                {ok ? "" : ` (${t.noVoice})`}
              </option>
            );
          })}
        </select>
      </div>
      <p className="sub">{t.levelsIntro}</p>
      {sims
        .filter((s) => s.level === licence)
        .map((s) => (
          <article className="card" key={s.id}>
            <div className="meta">
              <b>{s.accent_pt}</b>
              <span>
                {s.steps.length} {t.steps}
              </span>
              {[1, 2, 3].every((n) => done(s.id, n)) && <span className="done">✓ {t.allLevels}</span>}
            </div>
            <h2>{s.title}</h2>
            <p className="sub">{s.place}</p>
            <p className="sub">{s.summary_pt}</p>
            <div className="levels">
              {LEVELS.map((L) => {
                const r = progress[s.id]?.[L.n];
                const isOpen = open(s.id, L.n);
                return (
                  <button
                    key={L.n}
                    className={`lvbtn ${r ? "done" : isOpen ? "open" : ""}`}
                    disabled={!isOpen}
                    onClick={() => props.onStart(s, L.n)}
                  >
                    {t.level} {L.n} · {lang === "pt" ? L.name_pt : L.name_en}
                    <small>
                      {r ? `✓ ${r.best} ${r.best === 1 ? t.error1 : t.errorN}` : isOpen ? t.available : `🔒 ${t.locked}`}
                    </small>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
    </section>
  );
}

/* ---------------- one simulation run ---------------- */

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function SimRun(props: {
  run: Run;
  setRun: (r: Run) => void;
  accentLang: string;
  voice: ReturnType<typeof useAtcVoice>;
  onFinish: (r: Run) => void;
  onExit: () => void;
  onStart: (s: Simulation, level: number) => void;
}) {
  const { t, lang } = useI18n();
  const { run, voice, accentLang } = props;
  const step: Step = run.sim.steps[run.index];
  const quiz = isQuiz(step);
  const cs = run.callsign;

  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [solved, setSolved] = useState(false);
  const [tried, setTried] = useState(false);
  const [showText, setShowText] = useState(!voice.supported);
  const [showPt, setShowPt] = useState(false);
  const [slow, setSlow] = useState(false);
  const [wrongPicks, setWrongPicks] = useState<string[]>([]);
  const nextRef = useRef<HTMLButtonElement>(null);

  const reference = quiz ? step.answer : fillCallsign(step.readback, cs);
  const options = useMemo(
    () => shuffle([reference, ...step.wrong.map((w) => fillCallsign(w, cs))]),
    // a new order per step only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step.id, cs],
  );

  const resetForStep = useCallback(() => {
    setAnswer("");
    setFeedback(null);
    setSolved(false);
    setTried(false);
    setShowText(!voice.supported);
    setShowPt(false);
    setWrongPicks([]);
  }, [voice.supported]);

  const play = useCallback(() => {
    if (!quiz) voice.speak(fillCallsign(step.atc, cs), accentLang, slow);
  }, [quiz, voice, step, cs, accentLang, slow]);

  // speak each new transmission automatically (the student has already clicked to get here)
  useEffect(() => {
    if (run.finished) return;
    const id = setTimeout(play, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id, run.finished]);

  const mark = (ok: boolean, results?: KeyResult[]) => {
    setFeedback({ ok, results });
    if (ok) {
      setSolved(true);
      setShowText(true);
      if (!tried) props.setRun({ ...run, firstTry: run.firstTry + 1 });
      setTimeout(() => nextRef.current?.focus(), 30);
    } else {
      if (!tried) props.setRun({ ...run, errors: run.errors + 1 });
      setTried(true);
    }
  };

  const check = (text = answer) => {
    if (solved || !text.trim()) return;
    const r = checkAnswer(text, step.keys, cs);
    mark(r.ok, r.results);
  };

  const choose = (opt: string) => {
    if (solved) return;
    if (opt === reference) mark(true);
    else {
      setWrongPicks((w) => [...w, opt]);
      mark(false);
    }
  };

  const next = () => {
    if (!solved) return;
    if (run.index < run.sim.steps.length - 1) {
      props.setRun({ ...run, index: run.index + 1 });
      resetForStep();
    } else props.onFinish(run);
  };

  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);
  const speech = useSpeechInput(
    (text) => setAnswer((a) => (a ? `${a} ${text.trim()}` : text.trim())),
    () => {
      if (answerRef.current.trim()) check(answerRef.current);
    },
  );

  const accentName = (() => {
    const a = ACCENTS.find((x) => x.lang === accentLang);
    return (a ? (lang === "pt" ? a.pt : a.en) : accentLang).toLowerCase();
  })();
  const v = voice.pick(accentLang);
  const voiceLine = !voice.supported
    ? t.noTts
    : !v
      ? t.loading
      : v.lang.toLowerCase().startsWith(accentLang.split("-")[0].toLowerCase())
        ? t.voiceUsing(v.name, accentName)
        : t.voiceMissing(accentName, v.name);

  const levelName = lang === "pt" ? LEVELS[run.level - 1].name_pt : LEVELS[run.level - 1].name_en;
  const total = run.sim.steps.length;

  return (
    <section className="view">
      <div className="topbar">
        <button className="link" onClick={props.onExit}>
          ← {t.back}
        </button>
        <span className="steps">{t.stepOf(run.index + 1, total)}</span>
      </div>
      <div className="lvtag">
        {t.level} {run.level} · {levelName}
      </div>
      <h2>{run.sim.title}</h2>
      <div className="bar">
        <i style={{ width: `${((run.finished ? total : run.index) / total) * 100}%` }} />
      </div>
      <p className="cs">
        {t.yourCallsign}: <b>{cs}</b>
      </p>

      {run.finished ? (
        <Done run={run} onStart={props.onStart} onExit={props.onExit} />
      ) : (
        <>
          <div className="com">
            <div>
              <small>{quiz ? t.theory : t.comActive}</small>
              <div className="freq">{quiz ? "?" : step.freq}</div>
            </div>
            <div className="stn">{quiz ? t.question : step.station}</div>
          </div>
          <p className="ctx">
            {quiz ? (
              t.theoryCtx
            ) : (
              <>
                <b>{step.phase}.</b> {step.context_pt}
              </>
            )}
          </p>

          <div className="card">
            <div className="lbl">{quiz ? t.question : t.atcTx}</div>
            {quiz ? (
              <p className="q">{step.q_pt}</p>
            ) : (
              <>
                <div className="row">
                  <button className="btn primary" onClick={play} disabled={!voice.supported}>
                    {t.listen}
                  </button>
                  <button className="btn" aria-pressed={slow} onClick={() => setSlow((s) => !s)}>
                    {slow ? t.normalSpeed : t.slower}
                  </button>
                  <button className="btn" onClick={() => setShowText((s) => !s)}>
                    {showText ? t.hideText : t.showText}
                  </button>
                  <button className="btn" aria-pressed={showPt} onClick={() => setShowPt((s) => !s)}>
                    PT
                  </button>
                </div>
                {showText ? (
                  <p className="msg">{fillCallsign(step.atc, cs)}</p>
                ) : (
                  <p className="hiddenmsg">· · · · · · · ·</p>
                )}
                {showPt && <p className="pt">{fillCallsign(step.atc_pt, cs)}</p>}
                <p className="voice">{voiceLine}</p>
              </>
            )}
          </div>

          <div className="card">
            <label className="lbl" htmlFor="answer">
              {quiz ? t.yourAnswer : t.yourReadback}
            </label>
            {run.mode === "choose" ? (
              <div className="opts">
                {options.map((o) => (
                  <button
                    key={o}
                    className={`opt ${solved && o === reference ? "right" : ""} ${wrongPicks.includes(o) ? "wrong" : ""}`}
                    disabled={wrongPicks.includes(o)}
                    onClick={() => choose(o)}
                  >
                    {o}
                  </button>
                ))}
              </div>
            ) : (
              <div className="view" style={{ gap: 8 }}>
                {run.mode === "voice" && (
                  <div className="mic">
                    {speech.status !== "unsupported" && speech.status !== "denied" && (
                      <button
                        className={`btn primary ${speech.listening ? "rec" : ""}`}
                        disabled={solved}
                        onClick={() => {
                          if (speech.listening) speech.stop();
                          else {
                            voice.stop();
                            speech.start();
                          }
                        }}
                      >
                        {speech.listening ? t.stop : t.speak}
                      </button>
                    )}
                    <button className="btn" disabled={solved} onClick={() => { setAnswer(""); setFeedback(null); }}>
                      {t.clear}
                    </button>
                    <span className="voice">
                      {speech.status === "unsupported"
                        ? t.voiceUnsupported
                        : speech.status === "denied"
                          ? t.voiceDenied
                          : t.voiceHint}
                    </span>
                  </div>
                )}
                {speech.partial && <p className="partial">{speech.partial}</p>}
                <textarea
                  id="answer"
                  value={answer}
                  readOnly={run.mode === "voice" && speech.status !== "unsupported" && speech.status !== "denied"}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (solved) next();
                      else check();
                    }
                  }}
                  placeholder={run.mode === "voice" ? t.phVoice : quiz ? t.phQuiz : t.phWrite}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </div>
            )}
            <div className="row">
              {run.mode !== "choose" && (
                <button className="btn primary" onClick={() => check()} disabled={solved}>
                  {t.check}
                </button>
              )}
              <button className="btn" ref={nextRef} onClick={next} disabled={!solved}>
                {t.next}
              </button>
            </div>
          </div>

          {feedback && (
            <div className={`fb ${feedback.ok ? "good" : "badfb"}`}>
              <div className={`score ${feedback.ok ? "ok" : "bad"}`}>
                {feedback.ok
                  ? run.mode === "choose"
                    ? t.correct
                    : quiz
                      ? t.right
                      : t.readbackOk
                  : run.mode === "choose"
                    ? t.wrongChoice
                    : quiz || !feedback.results
                      ? t.notYet
                      : t.missing(feedback.results.filter((r) => !r.ok).length, feedback.results.length)}
              </div>
              {!quiz && feedback.results && (
                <ul className="chips">
                  {feedback.results.map((r) => (
                    <li key={r.label} className={r.ok ? "y" : "n"}>
                      {r.ok ? "✓" : "✗"} {r.label}
                    </li>
                  ))}
                </ul>
              )}
              {!feedback.ok && !feedback.revealed && (
                <>
                  <p className="note">{t.tryAgain}</p>
                  <div className="row">
                    <button
                      className="btn"
                      onClick={() => {
                        setFeedback({ ...feedback, revealed: true });
                        setShowText(true);
                      }}
                    >
                      {t.reveal}
                    </button>
                  </div>
                </>
              )}
              {(feedback.ok || feedback.revealed) && (
                <>
                  <div className="lbl">{quiz ? t.answer : t.reference}</div>
                  <p className="msg">{reference}</p>
                  {!quiz && <p className="pt">{fillCallsign(step.readback_pt, cs)}</p>}
                  <p className="note">{step.note_pt}</p>
                  {!feedback.ok && <p className="note">{t.nowDo[run.mode]}</p>}
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Done({ run, onStart, onExit }: { run: Run; onStart: (s: Simulation, l: number) => void; onExit: () => void }) {
  const { t, lang } = useI18n();
  const nextLevel = run.level < 3 ? LEVELS[run.level] : null;
  return (
    <div className="card">
      <div className="lbl">{t.done}</div>
      <h2>{run.sim.title}</h2>
      <div className="row" style={{ gap: 24 }}>
        <div>
          <div className="big-num">
            {run.firstTry}/{run.sim.steps.length}
          </div>
          <div className="sub">{t.firstTry}</div>
        </div>
        <div>
          <div className="big-num">{run.errors}</div>
          <div className="sub">{run.errors === 1 ? t.stepsWithError1 : t.stepsWithErrorN}</div>
        </div>
      </div>
      <p className="note">
        {nextLevel ? t.unlocked(nextLevel.n, (lang === "pt" ? nextLevel.name_pt : nextLevel.name_en).toLowerCase()) : t.allDone}
      </p>
      <div className="row">
        {nextLevel && (
          <button className="btn primary" onClick={() => onStart(run.sim, nextLevel.n)}>
            {t.startLevel(nextLevel.n)}
          </button>
        )}
        <button className={`btn ${nextLevel ? "" : "primary"}`} onClick={() => onStart(run.sim, run.level)}>
          {t.repeatLevel(run.level)}
        </button>
        <button className="btn" onClick={onExit}>
          {t.otherSim}
        </button>
      </div>
    </div>
  );
}

/* ---------------- review all content ---------------- */

function Review({ sims, id, setId }: { sims: Simulation[]; id: string; setId: (id: string) => void; lang: string }) {
  const { t } = useI18n();
  const sim = sims.find((s) => s.id === id) ?? sims[0];
  const cs = newCallsign(sim.level, () => 0.026);
  return (
    <section className="view">
      <select id="revsim" aria-label={t.review} value={sim.id} onChange={(e) => setId(e.target.value)}>
        {sims.map((s) => (
          <option key={s.id} value={s.id}>
            {s.level} · {s.title}
          </option>
        ))}
      </select>
      <p className="sub">
        {sim.place} · {sim.accent_pt}
      </p>
      {sim.steps.map((st, i) =>
        isQuiz(st) ? (
          <article className="card" key={st.id}>
            <div className="meta">
              <b>{t.question}</b>
              <span>#{i + 1}</span>
            </div>
            <p className="q">{st.q_pt}</p>
            <p className="msg">{st.answer}</p>
            <p className="note">{st.note_pt}</p>
          </article>
        ) : (
          <article className="card" key={st.id}>
            <div className="meta">
              <b>{st.phase}</b>
              <span>
                {st.station} {st.freq}
              </span>
              <span>#{i + 1}</span>
            </div>
            <p className="ctx">{st.context_pt}</p>
            <p className="msg">
              {t.atc}: {fillCallsign(st.atc, cs)}
            </p>
            <p className="pt">{fillCallsign(st.atc_pt, cs)}</p>
            <p className="msg">
              {t.pilot}: {fillCallsign(st.readback, cs)}
            </p>
            <p className="pt">{fillCallsign(st.readback_pt, cs)}</p>
            <p className="note">{st.note_pt}</p>
          </article>
        ),
      )}
    </section>
  );
}

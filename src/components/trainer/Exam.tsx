"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { newCallsign } from "@/lib/engine/callsign";
import {
  EXAM_SIZE,
  PASS_MARK,
  SECONDS_PER_ITEM,
  buildExam,
  examScore,
  loadExams,
  passed,
  saveExam,
  uploadExam,
  type ExamItem,
  type ExamRecord,
} from "@/lib/engine/exam";
import { fillCallsign } from "@/lib/engine/normalize";
import { choiceOptions, gradeStep, referenceOf } from "@/lib/engine/grade";
import { isCall, isQuiz, type Licence, type Simulation } from "@/lib/engine/types";
import { useI18n } from "@/lib/i18n/provider";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { useAtcVoice } from "./useAtcVoice";

type Mode = "choose" | "write";

interface Answered {
  item: ExamItem;
  given: string;
  ok: boolean;
}

interface Running {
  items: ExamItem[];
  mode: Mode;
  callsign: string;
  index: number;
  answers: Answered[];
  endsAt: number;
  startedAt: number;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** Timed exam: 20 random steps, one try each, marked at the end. */
export default function Exam(props: {
  sims: Simulation[];
  licence: Licence;
  accentFor: (sim: Simulation) => string;
  voice: ReturnType<typeof useAtcVoice>;
  onMistake?: (stepId: string) => void;
  onFinish?: (rec: ExamRecord) => void;
}) {
  const { t } = useI18n();
  const { voice, licence } = props;
  const [mode, setMode] = useState<Mode>("write");
  const [run, setRun] = useState<Running | null>(null);
  const [result, setResult] = useState<{ rec: ExamRecord; answers: Answered[]; callsign: string } | null>(null);
  const [history, setHistory] = useState<ExamRecord[]>(loadExams);
  const [now, setNow] = useState(() => Date.now());
  const [answer, setAnswer] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const start = () => {
    const items = buildExam(props.sims, licence);
    const t0 = Date.now();
    setRun({
      items,
      mode,
      callsign: newCallsign(licence),
      index: 0,
      answers: [],
      startedAt: t0,
      endsAt: t0 + items.length * SECONDS_PER_ITEM * 1000,
    });
    setResult(null);
    setAnswer("");
    setNow(t0);
  };

  const finish = (r: Running, answers: Answered[]) => {
    voice.stop();
    // anything left when time runs out counts as wrong
    const all = [...answers, ...r.items.slice(answers.length).map((item) => ({ item, given: "", ok: false }))];
    const right = all.filter((a) => a.ok).length;
    const rec: ExamRecord = {
      date: new Date().toISOString(),
      licence,
      score: examScore(right, all.length),
      right,
      total: all.length,
      seconds: Math.round((Math.min(Date.now(), r.endsAt) - r.startedAt) / 1000),
    };
    for (const a of all) if (!a.ok) props.onMistake?.(a.item.step.id);
    setHistory(saveExam(rec));
    if (isSupabaseConfigured()) void uploadExam(rec);
    props.onFinish?.(rec);
    setResult({ rec, answers: all, callsign: r.callsign });
    setRun(null);
  };

  // clock: ticks the display and ends the exam when time runs out
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);
  useEffect(() => {
    if (!run) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const r = runRef.current;
      if (r && t >= r.endsAt) finish(r, r.answers);
    }, 500);
    return () => clearInterval(id);
    // one clock per exam
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.startedAt]);
  const left = run ? Math.max(0, Math.ceil((run.endsAt - now) / 1000)) : 0;

  const item = run?.items[run.index];
  const cs = run?.callsign ?? "";
  const quiz = item ? isQuiz(item.step) : false;
  const call = item ? isCall(item.step) : false;
  const choice = run?.mode === "choose" || quiz;
  const options = useMemo(
    () => (item ? shuffle(choiceOptions(item.step, cs)) : []),
    // a new order per question only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item?.step.id, cs],
  );

  const play = () => {
    if (item && !isQuiz(item.step) && !isCall(item.step)) voice.speak(fillCallsign(item.step.atc, cs), props.accentFor(item.sim), false);
  };

  useEffect(() => {
    if (!item) return;
    const id = setTimeout(() => {
      play();
      inputRef.current?.focus();
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.step.id]);

  const submit = (given: string) => {
    if (!run || !item || !given.trim()) return;
    const ok = choice ? given === referenceOf(item.step, cs) : gradeStep(item.step, given, cs).ok;
    const answers = [...run.answers, { item, given, ok }];
    setAnswer("");
    if (run.index === run.items.length - 1) finish(run, answers);
    else setRun({ ...run, index: run.index + 1, answers });
  };

  if (run && item)
    return (
      <section className="view">
        <div className="topbar">
          <span className="steps">{t.stepOf(run.index + 1, run.items.length)}</span>
          <span className={`steps ${left < 60 ? "timer-low" : ""}`} aria-live="off">
            ⏱ {fmt(left)}
          </span>
        </div>
        <div className="bar">
          <i style={{ width: `${(run.index / run.items.length) * 100}%` }} />
        </div>
        <p className="cs">
          {t.yourCallsign}: <b>{cs}</b>
        </p>
        <div className="com">
          <div>
            <small>{quiz ? t.theory : t.comActive}</small>
            <div className="freq">{isQuiz(item.step) ? "?" : item.step.freq}</div>
          </div>
          <div className="stn">{isQuiz(item.step) ? t.question : item.step.station}</div>
        </div>
        <div className="card">
          {isQuiz(item.step) ? (
            <p className="q">{item.step.q_pt}</p>
          ) : isCall(item.step) ? (
            <>
              <p className="ctx">
                <b>{item.step.phase}.</b> {fillCallsign(item.step.context_pt, cs)}
              </p>
              <p className="q">{fillCallsign(item.step.task_pt, cs)}</p>
            </>
          ) : (
            <>
              <p className="ctx">
                <b>{item.step.phase}.</b> {item.step.context_pt}
              </p>
              <div className="row">
                <button className="btn primary" onClick={play} disabled={!voice.supported}>
                  {t.listen}
                </button>
              </div>
              {!voice.supported && <p className="msg">{fillCallsign(item.step.atc, cs)}</p>}
            </>
          )}
        </div>
        <div className="card">
          <label className="lbl" htmlFor="exam-answer">
            {quiz ? t.yourAnswer : call ? t.yourCall : t.yourReadback}
          </label>
          {choice ? (
            <div className="opts">
              {options.map((o) => (
                <button key={o} className="opt" onClick={() => submit(o)}>
                  {o}
                </button>
              ))}
            </div>
          ) : (
            <>
              <textarea
                id="exam-answer"
                ref={inputRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(answer);
                  }
                }}
                placeholder={call ? t.phCall : t.phWrite}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <div className="row">
                <button className="btn primary" onClick={() => submit(answer)} disabled={!answer.trim()}>
                  {t.examSubmit}
                </button>
              </div>
            </>
          )}
          <p className="note">{t.examOneTry}</p>
        </div>
      </section>
    );

  return (
    <section className="view">
      {result ? (
        <div className={`card exam-result ${passed(result.rec.score) ? "pass" : "fail"}`}>
          <div className="lbl">{t.examResult}</div>
          <div className="big-num">{result.rec.score}%</div>
          <div className={`score ${passed(result.rec.score) ? "ok" : "bad"}`}>
            {passed(result.rec.score) ? t.examPass : t.examFail(PASS_MARK)}
          </div>
          <p className="sub">
            {t.examRight(result.rec.right, result.rec.total)} · {fmt(result.rec.seconds)}
          </p>
        </div>
      ) : (
        <p className="sub">{t.examIntro(EXAM_SIZE, Math.round((EXAM_SIZE * SECONDS_PER_ITEM) / 60), PASS_MARK)}</p>
      )}

      <div className="controls">
        <div className="seg" role="group" aria-label={t.examMode}>
          {(["write", "choose"] as const).map((m) => (
            <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m === "write" ? t.examWrite : t.examChoose}
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={start}>
          {result ? t.examAgain : t.examStart(licence)}
        </button>
      </div>

      {result && result.answers.some((a) => !a.ok) && (
        <>
          <h2>{t.examMistakes}</h2>
          {result.answers
            .filter((a) => !a.ok)
            .map((a) => (
              <article className="card" key={a.item.step.id}>
                <div className="meta">
                  <b>{a.item.sim.title}</b>
                  <span>{a.item.step.phase}</span>
                </div>
                {isQuiz(a.item.step) ? (
                  <p className="q">{a.item.step.q_pt}</p>
                ) : isCall(a.item.step) ? (
                  <p className="q">{fillCallsign(a.item.step.task_pt, result.callsign)}</p>
                ) : (
                  <p className="msg">
                    {t.atc}: {fillCallsign(a.item.step.atc, result.callsign)}
                  </p>
                )}
                <p className="partial">
                  {t.examYours}: {a.given || "—"}
                </p>
                <p className="msg">
                  {t.answer}: {referenceOf(a.item.step, result.callsign)}
                </p>
                <p className="note">{a.item.step.note_pt}</p>
              </article>
            ))}
        </>
      )}

      {history.length > 0 && (
        <div className="card">
          <div className="lbl">{t.examHistory}</div>
          <ul className="exam-history">
            {history.slice(0, 8).map((h) => (
              <li key={h.date}>
                <span>{new Date(h.date).toLocaleDateString()}</span>
                <span>{h.licence}</span>
                <b className={passed(h.score) ? "ok" : "bad"}>{h.score}%</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

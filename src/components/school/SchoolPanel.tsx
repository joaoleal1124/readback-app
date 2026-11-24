"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { JOIN_CODE, cleanCode, daysSince, licenceProgress } from "@/lib/engine/school";
import type { Simulation } from "@/lib/engine/types";
import { useI18n } from "@/lib/i18n/provider";
import { getBrowserSupabase } from "@/lib/supabase/client";

interface ClassRow {
  id: string;
  name: string;
  join_code: string;
  instructor_id: string;
}

interface ReportRow {
  student_id: string;
  display_name: string;
  joined_at: string;
  done: string[];
  last_active: string | null;
  exams: number;
  best_exam: number | null;
  last_exam: number | null;
}

/** Schools: students join a class with a code; instructors create classes and follow their students. */
export default function SchoolPanel() {
  const { t } = useI18n();
  const supabase = getBrowserSupabase();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  if (!supabase)
    return (
      <section className="view">
        <h1>{t.schoolTitle}</h1>
        <p className="sub">{t.schoolIntro}</p>
        <div className="card">
          <p className="note">{t.schoolDemo}</p>
        </div>
      </section>
    );
  if (userId === undefined) return <p className="sub">{t.loading}</p>;
  if (!userId)
    return (
      <section className="view">
        <h1>{t.schoolTitle}</h1>
        <Link className="btn primary" href="/login?next=/escola">
          {t.login}
        </Link>
      </section>
    );
  return <Signed supabase={supabase} userId={userId} />;
}

function Signed({ supabase, userId }: { supabase: SupabaseClient; userId: string }) {
  const { t } = useI18n();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sims, setSims] = useState<Simulation[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data } = await supabase.from("classes").select("id, name, join_code, instructor_id").order("created_at");
    setClasses((data as ClassRow[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the database
    void reload();
    fetch("/api/sims", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setSims)
      .catch(() => {});
  }, [reload]);

  const teaching = classes.filter((c) => c.instructor_id === userId);
  const member = classes.filter((c) => c.instructor_id !== userId);

  const join = async () => {
    const c = cleanCode(code);
    if (!JOIN_CODE.test(c) || !name.trim()) return setMsg({ ok: false, text: t.schoolJoinFill });
    setBusy(true);
    const { data, error } = await supabase.rpc("join_class", { p_code: c, p_display_name: name.trim() });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message.includes("unknown code") ? t.schoolBadCode : t.schoolError });
    setMsg({ ok: true, text: t.schoolJoined((data as { class_name: string }[])?.[0]?.class_name ?? "") });
    setCode("");
    void reload();
  };

  const create = async () => {
    if (!className.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("create_class", { p_name: className.trim() });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: t.schoolError });
    const row = (data as ClassRow[])?.[0];
    setMsg({ ok: true, text: t.schoolCreated(row?.join_code ?? "") });
    setClassName("");
    await reload();
    if (row) setOpen(row.id);
  };

  const leave = async (classId: string) => {
    await supabase.from("class_members").delete().eq("class_id", classId).eq("student_id", userId);
    void reload();
  };

  return (
    <section className="view">
      <h1>{t.schoolTitle}</h1>
      <p className="sub">{t.schoolIntro}</p>
      {msg && (
        <div className={`fb ${msg.ok ? "good" : "badfb"}`} role="status">
          {msg.text}
        </div>
      )}

      <div className="card">
        <div className="lbl">{t.schoolStudent}</div>
        <div className="school-form">
          <input
            className="drill-input"
            value={code}
            onChange={(e) => setCode(cleanCode(e.target.value))}
            placeholder={t.schoolCodePh}
            aria-label={t.schoolCodePh}
            autoCapitalize="characters"
            autoComplete="off"
          />
          <input
            className="drill-input"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            placeholder={t.schoolNamePh}
            aria-label={t.schoolNamePh}
            autoComplete="name"
          />
          <button className="btn primary" onClick={join} disabled={busy}>
            {t.schoolJoin}
          </button>
        </div>
        {member.length > 0 && (
          <ul className="school-list">
            {member.map((c) => (
              <li key={c.id}>
                <span>{c.name}</span>
                <button className="link" onClick={() => leave(c.id)}>
                  {t.schoolLeave}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="lbl">{t.schoolInstructor}</div>
        <div className="school-form">
          <input
            className="drill-input"
            value={className}
            onChange={(e) => setClassName(e.target.value.slice(0, 80))}
            placeholder={t.schoolClassPh}
            aria-label={t.schoolClassPh}
          />
          <button className="btn primary" onClick={create} disabled={busy || !className.trim()}>
            {t.schoolCreate}
          </button>
        </div>
      </div>

      {teaching.map((c) => (
        <ClassReport
          key={c.id}
          supabase={supabase}
          cls={c}
          sims={sims}
          open={open === c.id}
          onToggle={() => setOpen(open === c.id ? null : c.id)}
          onDeleted={reload}
        />
      ))}
    </section>
  );
}

function ClassReport(props: {
  supabase: SupabaseClient;
  cls: ClassRow;
  sims: Simulation[];
  open: boolean;
  onToggle: () => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const { supabase, cls } = props;
  const [rows, setRows] = useState<ReportRow[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("class_report", { p_class_id: cls.id });
    setRows((data as ReportRow[]) ?? []);
  }, [supabase, cls.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the database
    if (props.open) void load();
  }, [props.open, load]);

  const remove = async (studentId: string) => {
    await supabase.from("class_members").delete().eq("class_id", cls.id).eq("student_id", studentId);
    void load();
  };

  const del = async () => {
    if (rows && rows.length && !window.confirm(t.schoolDeleteConfirm)) return;
    await supabase.from("classes").delete().eq("id", cls.id);
    props.onDeleted();
  };

  return (
    <article className="card">
      <div className="meta">
        <b>{t.schoolCode}</b>
        <span className="join-code">{cls.join_code}</span>
      </div>
      <h2>{cls.name}</h2>
      <div className="row">
        <button className="btn" onClick={props.onToggle}>
          {props.open ? t.schoolHide : t.schoolShow}
        </button>
        {props.open && (
          <button className="btn" onClick={load}>
            {t.schoolRefresh}
          </button>
        )}
      </div>
      {props.open &&
        (rows === null ? (
          <p className="sub">{t.loading}</p>
        ) : rows.length === 0 ? (
          <p className="note">{t.schoolNoStudents(cls.join_code)}</p>
        ) : (
          <div className="table-wrap">
            <table className="report">
              <thead>
                <tr>
                  <th>{t.schoolColStudent}</th>
                  <th>PPL</th>
                  <th>ATPL</th>
                  <th>{t.schoolColExams}</th>
                  <th>{t.schoolColActive}</th>
                  <th aria-label={t.schoolRemove} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const p = licenceProgress(r.done, props.sims);
                  const d = daysSince(r.last_active);
                  return (
                    <tr key={r.student_id}>
                      <td>{r.display_name}</td>
                      <td>
                        <Meter pct={p.PPL.pct} label={`${p.PPL.done}/${p.PPL.total}`} />
                      </td>
                      <td>
                        <Meter pct={p.ATPL.pct} label={`${p.ATPL.done}/${p.ATPL.total}`} />
                      </td>
                      <td>
                        {r.exams ? t.schoolExamCell(r.exams, r.best_exam ?? 0, r.last_exam ?? 0) : "—"}
                      </td>
                      <td className={d !== null && d > 7 ? "stale" : ""}>{d === null ? "—" : t.schoolDaysAgo(d)}</td>
                      <td>
                        <button className="link" onClick={() => remove(r.student_id)} aria-label={`${t.schoolRemove} ${r.display_name}`}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      {props.open && (
        <button className="link danger" onClick={del}>
          {t.schoolDelete}
        </button>
      )}
    </article>
  );
}

function Meter({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="meter" title={label}>
      <i style={{ width: `${pct}%` }} />
      <span>{pct}%</span>
    </div>
  );
}

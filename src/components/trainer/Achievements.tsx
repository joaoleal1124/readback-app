"use client";
import { ACHIEVEMENTS, bestStreak, streak, type Stats } from "@/lib/engine/achievements";
import { addDays, dayKey } from "@/lib/engine/srs";
import { useI18n } from "@/lib/i18n/provider";

/** Daily streak, the last two weeks of training and the achievement board. */
export default function Achievements({ stats, got }: { stats: Stats; got: Set<string> }) {
  const { t, lang } = useI18n();
  const today = dayKey(new Date());
  const current = streak(stats.days, today);
  const trainedToday = stats.days.includes(today);
  const days = new Set(stats.days);
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));

  return (
    <section className="view">
      <div className="card streak-card">
        <div className="streak-num">🔥 {current}</div>
        <div>
          <b>{t.streakDays(current)}</b>
          <p className="sub">{trainedToday ? t.streakToday : current ? t.streakKeep : t.streakStart}</p>
          <p className="sub">{t.streakBest(bestStreak(stats.days))}</p>
        </div>
      </div>
      <div className="card">
        <div className="lbl">{t.last14}</div>
        <div className="days14">
          {last14.map((d) => (
            <span key={d} className={days.has(d) ? "on" : ""} title={d}>
              {Number(d.slice(8))}
            </span>
          ))}
        </div>
      </div>
      <h2>
        {t.achievements} · {got.size}/{ACHIEVEMENTS.length}
      </h2>
      <div className="ach-grid">
        {ACHIEVEMENTS.map((a) => {
          const [name, how] = lang === "pt" ? a.pt : a.en;
          const on = got.has(a.id);
          return (
            <div key={a.id} className={`ach ${on ? "on" : ""}`}>
              <span className="ach-icon" aria-hidden>
                {on ? a.icon : "🔒"}
              </span>
              <b>{name}</b>
              <small>{how}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

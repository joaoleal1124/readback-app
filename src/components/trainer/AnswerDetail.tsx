"use client";
import type { Grade } from "@/lib/engine/grade";
import { useI18n } from "@/lib/i18n/provider";

/** What was wrong in a typed or spoken answer: each element, words said in excess, and tips. */
export default function AnswerDetail({ feedback }: { feedback: Partial<Pick<Grade, "results" | "extra" | "hints">> }) {
  const { t } = useI18n();
  return (
    <>
      {feedback.results && feedback.results.length > 0 && (
        <ul className="chips">
          {feedback.results.map((r, i) => (
            <li key={`${i}-${r.label}`} className={r.ok ? "y" : "n"}>
              {r.ok ? "✓" : r.status === "order" ? "↕" : "✗"} {r.label}
              {r.status === "order" ? ` (${t.outOfOrder})` : ""}
            </li>
          ))}
        </ul>
      )}
      {feedback.extra && feedback.extra.length > 0 && (
        <p className="note">
          {t.extraWords}: <b>{feedback.extra.join(" ")}</b>
        </p>
      )}
      {feedback.hints?.map((h) => (
        <p className="note" key={h}>
          {h}
        </p>
      ))}
    </>
  );
}

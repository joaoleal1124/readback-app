"use client";
import { useI18n } from "@/lib/i18n/provider";
import { LEGAL, type LegalDoc } from "./content";

/** Privacy policy or terms, in the interface language. */
export default function LegalPage({ doc }: { doc: LegalDoc }) {
  const { lang } = useI18n();
  const page = LEGAL[doc][lang];
  return (
    <article className="card legal">
      <h1 className="hero">{page.title}</h1>
      <p className="sub">{page.updated}</p>
      <p className="note draft">{page.draft}</p>
      {page.sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.p.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </section>
      ))}
    </article>
  );
}

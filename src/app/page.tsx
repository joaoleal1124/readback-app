"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";

export default function Landing() {
  const { t } = useI18n();
  return (
    <section className="view">
      <div className="com">
        <div>
          <small>{t.comActive}</small>
          <div className="freq">121.500</div>
        </div>
        <div className="stn">Readback</div>
      </div>
      <h1 className="hero">{t.heroTitle}</h1>
      <p className="sub">{t.heroBody}</p>
      <div className="row">
        <Link className="btn primary big" href="/treino">
          {t.start}
        </Link>
      </div>
    </section>
  );
}

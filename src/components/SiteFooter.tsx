"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";

export default function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="foot">
      <p>{t.footer}</p>
      <nav className="foot-links" aria-label={t.legal}>
        <Link href="/privacidade">{t.privacy}</Link>
        <Link href="/termos">{t.terms}</Link>
      </nav>
    </footer>
  );
}

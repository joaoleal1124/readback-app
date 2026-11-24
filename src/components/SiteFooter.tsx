"use client";
import { useI18n } from "@/lib/i18n/provider";

export default function SiteFooter() {
  const { t } = useI18n();
  return <p className="foot">{t.footer}</p>;
}

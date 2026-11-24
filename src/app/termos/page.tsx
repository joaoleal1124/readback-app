import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Termos · Readback" };

export default function TermsPage() {
  return <LegalPage doc="terms" />;
}

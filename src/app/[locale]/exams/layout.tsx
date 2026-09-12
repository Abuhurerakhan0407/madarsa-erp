import type { ReactNode } from "react";
import { requireOfficeSurface } from "@/lib/navigation/office-surface";
import "./exams.css";

export default async function ExamsLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireOfficeSurface(locale, ["assessment.marks.read", "assessment.marks.enter", "assessment.marks.moderate", "assessment.results.approve", "assessment.results.publish", "assessment.setup.manage"], "any");
  return children;
}

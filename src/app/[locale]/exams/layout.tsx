import type { ReactNode } from "react";
import { requireOfficeSurface } from "@/lib/navigation/office-surface";
import "./exams.css";

export default async function ExamsLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireOfficeSurface(locale);
  return children;
}

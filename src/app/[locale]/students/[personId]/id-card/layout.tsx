import type { ReactNode } from "react";
import { requireOfficeSurface } from "@/lib/navigation/office-surface";

export default async function StudentIdCardLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string; personId: string }> }) {
  const { locale } = await params;
  await requireOfficeSurface(locale, ["document.job.manage", "students.profile.read"]);
  return children;
}

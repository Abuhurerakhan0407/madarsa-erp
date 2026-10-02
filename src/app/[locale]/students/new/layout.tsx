import type { ReactNode } from "react";
import { requireOfficeSurface } from "@/lib/navigation/office-surface";

const admissionPermissions = [
  "admissions.application.review",
  "admissions.application.convert",
  "academics.enrollment.manage",
  "students.profile.update",
  "people.person.manage"
] as const;

export default async function NewStudentLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireOfficeSurface(locale, admissionPermissions);
  return children;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TeacherCreateForm } from "@/components/teacher-create-form";
import type { SupportedLocale } from "@/lib/i18n/config";
import { requireOfficeAudience } from "@/lib/navigation/office-gate";
import { getTeachersWorkspace } from "@/lib/teachers/workspace";

export const metadata: Metadata = { title: "Add Teacher / Staff | Ilmgaah" };
export default async function NewStaffPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params; const locale: SupportedLocale = rawLocale === "ur" ? "ur" : "en";
  await requireOfficeAudience(locale); const workspace = await getTeachersWorkspace(); if (!workspace.canManage) redirect(`/${locale}/staff`);
  return <div className="flow-stack"><TeacherCreateForm locale={locale} /></div>;
}

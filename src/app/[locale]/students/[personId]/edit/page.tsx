import Link from "next/link";
import { notFound } from "next/navigation";
import { StudentEditForm } from "@/components/student-edit-form";
import { StudentGuardianForm } from "@/components/student-guardian-form";
import type { Locale } from "@/lib/i18n/config";
import { getStudentDetail } from "@/lib/students/detail";

const copy = {
  en: { kicker: "Student profile · Edit", title: "Edit student", body: "Update identity, language, health, safeguarding and primary guardian information.", back: "Back to profile" },
  ur: { kicker: "طالب علم پروفائل · ترمیم", title: "طالب علم میں ترمیم", body: "شناخت، زبان، صحت، حفاظت اور بنیادی سرپرست کی معلومات اپ ڈیٹ کریں۔", back: "پروفائل پر واپس" },
  ar: { kicker: "ملف الطالب · تعديل", title: "تعديل الطالب", body: "حدّث بيانات الهوية واللغة والصحة والحماية وولي الأمر الأساسي.", back: "العودة للملف" }
} as const;

export default async function EditStudentPage({ params }: { params: Promise<{ locale: string; personId: string }> }) {
  const raw = await params;
  const locale = raw.locale as Locale;
  const personId = Number(raw.personId);
  if (!Number.isInteger(personId) || personId <= 0) notFound();
  const student = await getStudentDetail(personId, locale);
  if (!student) notFound();
  const text = copy[locale];
  return <>
    <section className="page-heading"><div><p className="state-kicker">{text.kicker}</p><h1>{text.title}</h1><p>{text.body}</p></div><Link className="action-button" href={`/${locale}/students/${personId}`}>{text.back}</Link></section>
    <div className="student-edit-stack">
      <StudentEditForm locale={locale} student={student} />
      <StudentGuardianForm locale={locale} personId={personId} guardian={student.guardian} />
    </div>
  </>;
}

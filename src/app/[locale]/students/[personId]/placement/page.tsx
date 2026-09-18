import Link from "next/link";
import { notFound } from "next/navigation";
import { StudentPlacementForm } from "@/components/student-placement-form";
import { operatorHasPermissions } from "@/lib/access/operator-permission";
import type { SupportedLocale } from "@/lib/i18n/config";
import { getStudentDetail } from "@/lib/students/detail";
import { getStudentPlacement } from "@/lib/students/placement";
import { getTenantContext } from "@/lib/tenancy/context";

const copy = {
  en: { kicker: "Student · Enrollment", title: "Manage class placement", body: "Change the student's class/group inside the current academic session and program. Program transfers and session promotion stay governed workflows elsewhere.", back: "Back to profile", session: "Academic session", program: "Program", current: "Current class / group" },
  ur: { kicker: "طالب علم · اندراج", title: "کلاس پلیسمنٹ منظم کریں", body: "موجودہ تعلیمی سال اور پروگرام کے اندر طالب علم کی کلاس/گروپ تبدیل کریں۔ پروگرام ٹرانسفر اور اگلے سال کی پروموشن الگ کنٹرول شدہ ورک فلو ہیں۔", back: "پروفائل پر واپس", session: "تعلیمی سال", program: "پروگرام", current: "موجودہ کلاس / گروپ" }
} as const;

export default async function StudentPlacementPage({ params }: { params: Promise<{ locale: string; personId: string }> }) {
  const raw = await params;
  const locale = raw.locale as SupportedLocale;
  const personId = Number(raw.personId);
  if (!Number.isInteger(personId) || personId <= 0) notFound();
  const workspace = await getTenantContext();
  if (!workspace?.branchId || !(await operatorHasPermissions(workspace, ["academics.enrollment.manage"]))) notFound();
  const [student, placement] = await Promise.all([getStudentDetail(personId, locale), getStudentPlacement(personId, locale)]);
  if (!student || !placement) notFound();
  const text = copy[locale];
  return <>
    <section className="page-heading"><div><p className="state-kicker">{text.kicker}</p><h1>{text.title}</h1><p>{text.body}</p></div><Link className="action-button" href={`/${locale}/students/${personId}`}>{text.back}</Link></section>
    <section className="panel">
      <div className="student-detail-grid"><div><span>{text.session}</span><strong>{placement.session}</strong></div><div><span>{text.program}</span><strong>{placement.program}</strong></div><div><span>{text.current}</span><strong>{placement.currentGroup}</strong></div></div>
    </section>
    <section className="panel"><StudentPlacementForm locale={locale} personId={personId} placement={placement} /></section>
  </>;
}

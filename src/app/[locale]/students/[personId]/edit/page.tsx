import Link from "next/link";
import { notFound } from "next/navigation";
import { StudentEditForm } from "@/components/student-edit-form";
import { StudentGuardianForm } from "@/components/student-guardian-form";
import { StudentPlacementForm } from "@/components/student-placement-form";
import { operatorHasPermissions } from "@/lib/access/operator-permission";
import { isLocale, type SupportedLocale } from "@/lib/i18n/config";
import { getStudentDetail } from "@/lib/students/detail";
import { getStudentPlacement } from "@/lib/students/placement";
import { getTenantContext } from "@/lib/tenancy/context";

const copy = {
  en: { kicker: "Student profile · Edit", title: "Edit student", body: "Update identity, class placement, language, health, safeguarding and primary guardian information.", back: "Back to profile", placement: "Academic placement", placementBody: "Move the student between active classes within the current academic session and program. Every change is recorded." },
  ur: { kicker: "طالب علم پروفائل · ترمیم", title: "طالب علم میں ترمیم", body: "شناخت، کلاس پلیسمنٹ، زبان، صحت، حفاظت اور بنیادی سرپرست کی معلومات اپ ڈیٹ کریں۔", back: "پروفائل پر واپس", placement: "تعلیمی پلیسمنٹ", placementBody: "موجودہ تعلیمی سال اور پروگرام کے فعال گروپس کے درمیان طالب علم کی کلاس تبدیل کریں۔ ہر تبدیلی ریکارڈ ہوتی ہے۔" }
} as const satisfies Record<SupportedLocale, object>;

export default async function EditStudentPage({ params }: { params: Promise<{ locale: string; personId: string }> }) {
  const raw = await params;
  if (!isLocale(raw.locale)) notFound();
  const locale: SupportedLocale = raw.locale;
  const personId = Number(raw.personId);
  if (!Number.isInteger(personId) || personId <= 0) notFound();
  const workspace = await getTenantContext();
  if (!workspace?.branchId) notFound();
  const [canEditStudent, canManagePlacement] = await Promise.all([
    operatorHasPermissions(workspace, ["people.person.manage", "students.profile.update"]),
    operatorHasPermissions(workspace, ["academics.enrollment.manage"])
  ]);
  if (!canEditStudent) notFound();
  const [student, placement] = await Promise.all([
    getStudentDetail(personId, locale),
    canManagePlacement ? getStudentPlacement(personId, locale) : Promise.resolve(null)
  ]);
  if (!student) notFound();
  const text = copy[locale];

  return <>
    <section className="page-heading"><div><p className="state-kicker">{text.kicker}</p><h1>{text.title}</h1><p>{text.body}</p></div><Link className="action-button" href={`/${locale}/students/${personId}`}>{text.back}</Link></section>
    <div className="student-edit-stack">
      <StudentEditForm locale={locale} student={student} />
      {placement ? <section className="panel"><header className="panel-header"><div><h2>{text.placement}</h2><span>{placement.session} · {placement.program} · {text.placementBody}</span></div></header><StudentPlacementForm locale={locale} personId={personId} placement={placement} /></section> : null}
      <StudentGuardianForm locale={locale} personId={personId} guardian={student.guardian} />
    </div>
  </>;
}

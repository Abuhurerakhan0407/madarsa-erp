import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { SuccessNotice, WorkspacePageHeader } from "@/components/workspace-ui";
import { isCapabilityEnabled, resolveClientProfile } from "@/lib/capabilities/client-profile";
import type { Locale } from "@/lib/i18n/config";
import { getStudentDetail } from "@/lib/students/detail";
import { getTenantContext } from "@/lib/tenancy/context";

const copy = {
  en: { kicker: "Student profile", back: "Back to students", edit: "Edit student", placement: "Manage placement", idCard: "ID card", print: "Print profile", created: "Student record created", createdBody: "The permanent student profile and academic placement were saved successfully.", identity: "Identity & placement", guardian: "Primary guardian", attendance: "Attendance", quran: "Qur'an / Hifz", fees: "Fees", results: "Published results", wellbeing: "Health & safeguarding", studentId: "Student ID", admission: "Admission no.", program: "Program", group: "Class / group", joined: "Joined", dob: "Date of birth", gender: "Gender", status: "Status", present: "Present", absent: "Absent", late: "Late", excused: "Excused / leave", attempts: "Recorded attempts", invoiced: "Invoiced", paid: "Net collected", outstanding: "Outstanding", reports: "Result records", medical: "Medical", accessibility: "Accessibility / learning needs", pickup: "Pickup restrictions", none: "No information recorded", phone: "Phone", occupation: "Occupation", education: "Education", collection: "Pickup authority", allowed: "Authorized", notAllowed: "Not authorized" },
  ur: { kicker: "طالب علم پروفائل", back: "طلبہ پر واپس", edit: "طالب علم میں ترمیم", placement: "پلیسمنٹ منظم کریں", idCard: "ID کارڈ", print: "پروفائل پرنٹ کریں", created: "طالب علم ریکارڈ بن گیا", createdBody: "مستقل طالب علم پروفائل اور تعلیمی تعیناتی کامیابی سے محفوظ ہو گئی۔", identity: "شناخت و تعلیمی تعیناتی", guardian: "بنیادی سرپرست", attendance: "حاضری", quran: "قرآن / حفظ", fees: "فیس", results: "شائع شدہ نتائج", wellbeing: "صحت و حفاظت", studentId: "طالب علم ID", admission: "داخلہ نمبر", program: "پروگرام", group: "کلاس / گروپ", joined: "شمولیت", dob: "تاریخ پیدائش", gender: "جنس", status: "حالت", present: "حاضر", absent: "غیر حاضر", late: "تاخیر", excused: "رخصت / معذور", attempts: "ریکارڈ شدہ کوششیں", invoiced: "انوائس", paid: "خالص وصولی", outstanding: "بقایا", reports: "نتیجہ ریکارڈ", medical: "طبی معلومات", accessibility: "خصوصی / تعلیمی ضروریات", pickup: "پک اپ پابندیاں", none: "کوئی معلومات درج نہیں", phone: "فون", occupation: "پیشہ", education: "تعلیم", collection: "پک اپ اختیار", allowed: "اجازت ہے", notAllowed: "اجازت نہیں" },
  ar: { kicker: "ملف الطالب", back: "العودة للطلاب", edit: "تعديل الطالب", placement: "إدارة التوزيع", idCard: "بطاقة الهوية", print: "طباعة الملف", created: "تم إنشاء سجل الطالب", createdBody: "تم حفظ ملف الطالب الدائم والتسجيل الأكاديمي بنجاح.", identity: "الهوية والتسجيل", guardian: "ولي الأمر الأساسي", attendance: "الحضور", quran: "القرآن / الحفظ", fees: "الرسوم", results: "النتائج المنشورة", wellbeing: "الصحة والحماية", studentId: "رقم الطالب", admission: "رقم القبول", program: "البرنامج", group: "الفصل / المجموعة", joined: "الالتحاق", dob: "تاريخ الميلاد", gender: "الجنس", status: "الحالة", present: "حاضر", absent: "غائب", late: "متأخر", excused: "معذور / إجازة", attempts: "محاولات مسجلة", invoiced: "مفوتر", paid: "صافي المحصل", outstanding: "مستحق", reports: "سجلات النتائج", medical: "طبي", accessibility: "احتياجات التعلم / الوصول", pickup: "قيود الاستلام", none: "لا توجد معلومات مسجلة", phone: "الهاتف", occupation: "المهنة", education: "التعليم", collection: "صلاحية الاستلام", allowed: "مصرح", notAllowed: "غير مصرح" }
} as const;

function money(amount: number, currency: string, locale: Locale) {
  try { return new Intl.NumberFormat(locale === "en" ? "en-IN" : locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount); } catch { return `${currency} ${amount.toFixed(0)}`; }
}

type StudentProfilePageProps = {
  params: Promise<{ locale: string; personId: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default async function StudentProfilePage({ params, searchParams }: StudentProfilePageProps) {
  const [raw, query, workspace] = await Promise.all([params, searchParams, getTenantContext()]);
  const locale = raw.locale as Locale;
  const personId = Number(raw.personId);
  if (!Number.isInteger(personId) || personId <= 0 || !workspace) notFound();
  const student = await getStudentDetail(personId, locale);
  if (!student) notFound();
  const text = copy[locale];
  const profile = resolveClientProfile(workspace.tenantSlug, workspace.clientProfile);
  const showFinance = isCapabilityEnabled(profile, "fees_accounting");
  const hasMetrics = student.attendance !== null || student.quranAttempts !== null || student.resultCount !== null;

  return <div className="student-print-profile">
    <WorkspacePageHeader
      eyebrow={text.kicker}
      title={student.name}
      description={student.nativeName || student.studentNumber}
      actions={[
        { label: text.back, href: `/${locale}/students` },
        { label: text.edit, href: `/${locale}/students/${personId}/edit` },
        { label: text.placement, href: `/${locale}/students/${personId}/placement` },
        { label: text.idCard, href: `/${locale}/students/${personId}/id-card` }
      ]}
      actionSlot={<PrintButton label={text.print} />}
    />

    {query.created === "1" ? <SuccessNotice title={text.created} body={text.createdBody} /> : null}

    <section className="panel" data-page-section><header className="panel-header"><h2>{text.identity}</h2><span className="status-pill">{student.status}</span></header><div className="student-detail-grid"><div><span>{text.studentId}</span><strong>{student.studentNumber}</strong></div><div><span>{text.admission}</span><strong>{student.admissionNumber || "—"}</strong></div><div><span>{text.program}</span><strong>{student.program}</strong></div><div><span>{text.group}</span><strong>{student.group}</strong></div><div><span>{text.joined}</span><strong>{student.joinedOn || "—"}</strong></div><div><span>{text.dob}</span><strong>{student.dateOfBirth || "—"}</strong></div><div><span>{text.gender}</span><strong>{student.gender || "—"}</strong></div><div><span>{text.status}</span><strong>{student.status}</strong></div></div></section>

    <section className="dashboard-grid" data-page-section><article className="panel"><header className="panel-header"><h2>{text.guardian}</h2></header>{student.guardian ? <div className="student-detail-grid"><div><span>{student.guardian.relationship}</span><strong>{student.guardian.name}</strong></div><div><span>{text.phone}</span><strong>{student.guardian.phone || "—"}</strong></div><div><span>{text.occupation}</span><strong>{student.guardian.occupation || "—"}</strong></div><div><span>{text.education}</span><strong>{student.guardian.education || "—"}</strong></div><div><span>{text.collection}</span><strong>{student.guardian.canCollect ? text.allowed : text.notAllowed}</strong></div></div> : <p>{text.none}</p>}</article><article className="panel"><header className="panel-header"><h2>{text.wellbeing}</h2></header><dl className="student-notes"><div><dt>{text.medical}</dt><dd>{student.medicalSummary || text.none}</dd></div><div><dt>{text.accessibility}</dt><dd>{student.accessibilityNeeds || text.none}</dd></div><div><dt>{text.pickup}</dt><dd>{student.pickupRestrictions || text.none}</dd></div></dl></article></section>

    {hasMetrics ? <section className="metric-grid" data-page-section>
      {student.attendance ? <article className="metric"><span>{text.attendance}</span><strong>{student.attendance.total ? `${Math.round((student.attendance.present / student.attendance.total) * 100)}%` : "—"}</strong><small>{student.attendance.present} {text.present} · {student.attendance.absent} {text.absent} · {student.attendance.late} {text.late} · {student.attendance.excused} {text.excused}</small></article> : null}
      {student.quranAttempts !== null ? <article className="metric"><span>{text.quran}</span><strong>{student.quranAttempts}</strong><small>{text.attempts}</small></article> : null}
      {student.resultCount !== null ? <article className="metric"><span>{text.results}</span><strong>{student.resultCount}</strong><small>{text.reports}</small></article> : null}
    </section> : null}

    {showFinance && student.finance ? <section className="panel" data-page-section><header className="panel-header"><h2>{text.fees}</h2></header><div className="student-detail-grid"><div><span>{text.invoiced}</span><strong>{money(student.finance.invoiced, student.finance.currency, locale)}</strong></div><div><span>{text.paid}</span><strong>{money(student.finance.paid, student.finance.currency, locale)}</strong></div><div><span>{text.outstanding}</span><strong>{money(student.finance.outstanding, student.finance.currency, locale)}</strong></div></div></section> : null}
  </div>;
}

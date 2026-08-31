import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import type { Locale } from "@/lib/i18n/config";
import { getStudentIdCardBatch, normalizeIdCardStudentIds } from "@/lib/students/id-card-batch";
import { getTenantContext } from "@/lib/tenancy/context";
import styles from "../id-card-batch.module.css";

const copy = {
  en: { kicker: "Print sheet", title: "Bulk student ID cards", back: "Change selection", print: "Print A4 sheet", id: "Student ID", program: "Program", group: "Class / group", dob: "Date of birth", guardian: "Guardian", branch: "Campus", validity: "Academic year 2026–27", institutionCard: "Institution identity card", reverse: "Student information", instruction: "If found, please return this card to the institution administration office." },
  ur: { kicker: "پرنٹ شیٹ", title: "بلک طالب علم ID کارڈز", back: "انتخاب تبدیل کریں", print: "A4 شیٹ پرنٹ کریں", id: "طالب علم ID", program: "پروگرام", group: "کلاس / گروپ", dob: "تاریخ پیدائش", guardian: "سرپرست", branch: "کیمپس", validity: "تعلیمی سال 2026–27", institutionCard: "ادارہ شناختی کارڈ", reverse: "طالب علم معلومات", instruction: "اگر یہ کارڈ ملے تو ادارہ انتظامیہ کو واپس کریں۔" },
  ar: { kicker: "ورقة الطباعة", title: "بطاقات هوية الطلاب", back: "تغيير الاختيار", print: "طباعة ورقة A4", id: "رقم الطالب", program: "البرنامج", group: "الفصل / المجموعة", dob: "تاريخ الميلاد", guardian: "ولي الأمر", branch: "الحرم", validity: "العام الدراسي 2026–27", institutionCard: "بطاقة هوية المؤسسة", reverse: "معلومات الطالب", instruction: "في حال العثور على البطاقة يرجى إعادتها إلى إدارة المؤسسة." }
} as const;

function positive(value: string | undefined): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ST";
}

export default async function BulkIdCardPrintPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ session?: string; group?: string; student?: string | string[] }> }) {
  const locale = (await params).locale as Locale;
  const query = await searchParams;
  const sessionId = positive(query.session);
  const groupId = positive(query.group);
  const studentIds = normalizeIdCardStudentIds(query.student);
  if (!groupId || studentIds.length === 0) notFound();

  const [result, workspace] = await Promise.all([
    getStudentIdCardBatch({ locale, sessionId, groupId, personIds: studentIds }),
    getTenantContext()
  ]);
  if (!workspace) notFound();
  if (result.students.length !== studentIds.length) throw new Error("One or more selected students are no longer eligible for this ID-card batch.");

  const text = copy[locale];
  const branch = workspace.branchName || "Main Branch";
  const backHref = `/${locale}/students/id-cards?${new URLSearchParams({ ...(sessionId ? { session: String(sessionId) } : {}), group: String(groupId) }).toString()}`;

  return <div className={styles.printPage}>
    <section className={`page-heading ${styles.controls}`}>
      <div><p className="state-kicker">{text.kicker}</p><h1>{text.title}</h1><p>{result.students.length} cards · {branch}</p></div>
      <div className="quick-actions"><Link className="action-button" href={backHref}>{text.back}</Link><PrintButton label={text.print} /></div>
    </section>

    <section className={styles.sheet} aria-label={text.title}>
      {result.students.map((student) => <div className={styles.pair} key={student.personId}>
        <article className={styles.card}>
          <header className={styles.cardHeader}><div className={styles.brandMark}>M</div><div><strong>{workspace.tenantName}</strong><span>{text.institutionCard}</span></div></header>
          <div className={styles.frontBody}><div className={styles.avatar} aria-hidden="true">{initials(student.name)}</div><div className={styles.identity}><h2>{student.name}</h2>{student.nativeName ? <p dir="auto">{student.nativeName}</p> : null}<dl><div><dt>{text.id}</dt><dd>{student.studentNumber}</dd></div><div><dt>{text.program}</dt><dd>{student.program}</dd></div><div><dt>{text.group}</dt><dd>{student.group}</dd></div></dl></div></div>
          <footer className={styles.cardFooter}><span>{branch}</span><strong>{text.validity}</strong></footer>
        </article>
        <article className={`${styles.card} ${styles.backCard}`}>
          <header className={styles.backHeader}><strong>{workspace.tenantName}</strong><span>{text.reverse}</span></header>
          <dl className={styles.backDetails}><div><dt>{text.id}</dt><dd>{student.studentNumber}</dd></div><div><dt>{text.dob}</dt><dd>{student.dateOfBirth || "—"}</dd></div><div><dt>{text.guardian}</dt><dd>{student.guardianName || "—"}</dd></div><div><dt>{text.branch}</dt><dd>{branch}</dd></div></dl>
          <p className={styles.returnNote}>{text.instruction}</p>
          <footer className={styles.backFooter}><span>{workspace.tenantName}</span><span>{student.status}</span></footer>
        </article>
      </div>)}
    </section>
  </div>;
}

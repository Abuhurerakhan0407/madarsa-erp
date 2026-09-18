import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { operatorHasPermissions } from "@/lib/access/operator-permission";
import type { SupportedLocale } from "@/lib/i18n/config";
import { getStudentIdCardBatch, normalizeIdCardStudentIds } from "@/lib/students/id-card-batch";
import { getTenantContext } from "@/lib/tenancy/context";
import styles from "../id-card-batch.module.css";

const copy = {
  en: { kicker: "Print sheet", title: "Bulk student ID cards", back: "Change selection", print: "Print A4 sheet", pdf: "Download PDF", id: "Student ID", program: "Program", group: "Class / group", dob: "Date of birth", guardian: "Guardian", branch: "Campus", validity: "Academic session", institutionCard: "Institution identity card", reverse: "Student information", instruction: "If found, please return this card to the institution administration office." },
  ur: { kicker: "پرنٹ شیٹ", title: "بلک طالب علم ID کارڈز", back: "انتخاب تبدیل کریں", print: "A4 شیٹ پرنٹ کریں", pdf: "PDF ڈاؤن لوڈ کریں", id: "طالب علم ID", program: "پروگرام", group: "کلاس / گروپ", dob: "تاریخ پیدائش", guardian: "سرپرست", branch: "کیمپس", validity: "تعلیمی سیشن", institutionCard: "ادارہ شناختی کارڈ", reverse: "طالب علم معلومات", instruction: "اگر یہ کارڈ ملے تو ادارہ انتظامیہ کو واپس کریں۔" }
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
  if (!sessionId || !groupId || studentIds.length === 0) notFound();

  const workspace = await getTenantContext();
  if (!workspace?.branchId || !(await operatorHasPermissions(workspace, ["document.job.manage"]))) notFound();
  const result = await getStudentIdCardBatch({ locale, sessionId, groupId, personIds: studentIds });
  if (result.students.length !== studentIds.length) throw new Error("One or more selected students are no longer eligible for this ID-card batch.");

  const text = copy[locale];
  const branch = workspace.branchName || workspace.branchCode || "—";
  const brandInitial = workspace.tenantName.trim().slice(0, 1).toUpperCase();
  const academicSession = result.sessions.find((session) => session.id === sessionId)?.label;
  if (!academicSession) notFound();
  const backHref = `/${locale}/students/id-cards?${new URLSearchParams({ session: String(sessionId), group: String(groupId) }).toString()}`;
  const pdfParams = new URLSearchParams();
  pdfParams.set("session", String(sessionId));
  pdfParams.set("group", String(groupId));
  pdfParams.set("locale", locale === "ur" ? "ur" : "en");
  studentIds.forEach((personId) => pdfParams.append("student", String(personId)));
  const pdfHref = `/api/students/id-cards/pdf?${pdfParams.toString()}`;

  return <div className={styles.printPage}>
    <section className={`page-heading ${styles.controls}`}>
      <div><p className="state-kicker">{text.kicker}</p><h1>{text.title}</h1><p>{result.students.length} cards · {branch}</p></div>
      <div className="quick-actions"><Link className="action-button" href={backHref}>{text.back}</Link><a className="action-button" href={pdfHref}>{text.pdf}</a><PrintButton label={text.print} /></div>
    </section>

    <section className={styles.sheet} aria-label={text.title}>
      {result.students.map((student) => <div className={styles.pair} key={student.personId}>
        <article className={styles.card}>
          <header className={styles.cardHeader}><div className={styles.brandMark}>{brandInitial}</div><div><strong>{workspace.tenantName}</strong><span>{text.institutionCard}</span></div></header>
          <div className={styles.frontBody}>{student.photoStoragePath ? <img className={styles.avatar} src={`/api/students/photo/${student.personId}`} alt={student.name}/> : <div className={styles.avatar} aria-hidden="true">{initials(student.name)}</div>}<div className={styles.identity}><h2>{student.name}</h2>{student.nativeName ? <p dir="auto">{student.nativeName}</p> : null}<dl><div><dt>{text.id}</dt><dd>{student.studentNumber}</dd></div><div><dt>{text.program}</dt><dd>{student.program}</dd></div><div><dt>{text.group}</dt><dd>{student.group}</dd></div></dl></div></div>
          <footer className={styles.cardFooter}><span>{branch}</span><strong>{text.validity}: {academicSession}</strong></footer>
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

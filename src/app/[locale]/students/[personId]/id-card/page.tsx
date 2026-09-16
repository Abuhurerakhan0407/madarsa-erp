import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import type { Locale } from "@/lib/i18n/config";
import { getStudentDetail } from "@/lib/students/detail";
import { getTenantContext } from "@/lib/tenancy/context";
import styles from "./student-id-card.module.css";

const copy = {
  en: { kicker: "Student document", title: "Student ID card", back: "Back to profile", print: "Print ID card", id: "Student ID", program: "Program", group: "Class / group", dob: "Date of birth", guardian: "Guardian", branch: "Campus", validity: "Academic session", institutionCard: "Institution identity card", reverse: "Student information", instruction: "If found, please return this card to the institution administration office." },
  ur: { kicker: "طالب علم دستاویز", title: "طالب علم ID کارڈ", back: "پروفائل پر واپس", print: "ID کارڈ پرنٹ کریں", id: "طالب علم ID", program: "پروگرام", group: "کلاس / گروپ", dob: "تاریخ پیدائش", guardian: "سرپرست", branch: "کیمپس", validity: "تعلیمی سیشن", institutionCard: "ادارہ شناختی کارڈ", reverse: "طالب علم معلومات", instruction: "اگر یہ کارڈ ملے تو ادارہ انتظامیہ کو واپس کریں۔" },
  ar: { kicker: "وثيقة الطالب", title: "بطاقة هوية الطالب", back: "العودة للملف", print: "طباعة البطاقة", id: "رقم الطالب", program: "البرنامج", group: "الفصل / المجموعة", dob: "تاريخ الميلاد", guardian: "ولي الأمر", branch: "الحرم", validity: "العام الدراسي", institutionCard: "بطاقة هوية المؤسسة", reverse: "معلومات الطالب", instruction: "في حال العثور على البطاقة يرجى إعادتها إلى إدارة المؤسسة." }
} as const;

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ST";
}

export default async function StudentIdCardPage({ params }: { params: Promise<{ locale: string; personId: string }> }) {
  const raw = await params;
  const locale = raw.locale as Locale;
  const personId = Number(raw.personId);
  if (!Number.isInteger(personId) || personId <= 0) notFound();

  const [student, workspace] = await Promise.all([getStudentDetail(personId, locale), getTenantContext()]);
  if (!student || !workspace) notFound();
  const text = copy[locale];
  const branch = workspace.branchName || workspace.branchCode || "—";
  const brandInitial = workspace.tenantName.trim().slice(0, 1).toUpperCase();

  return <div className={styles.page}>
    <section className={`page-heading ${styles.controls}`}>
      <div><p className="state-kicker">{text.kicker}</p><h1>{text.title}</h1><p>{student.name} · {student.studentNumber}</p></div>
      <div className="quick-actions"><Link className="action-button" href={`/${locale}/students/${personId}`}>{text.back}</Link><PrintButton label={text.print} /></div>
    </section>

    <section className={styles.sheet} aria-label={text.title}>
      <article className={styles.card}>
        <header className={styles.cardHeader}><div className={styles.brandMark}>{brandInitial}</div><div><strong>{workspace.tenantName}</strong><span>{text.institutionCard}</span></div></header>
        <div className={styles.frontBody}>
          {student.photoStoragePath?<img className={styles.avatar} src={`/api/students/photo/${student.personId}`} alt={student.name}/>:<div className={styles.avatar} aria-hidden="true">{initials(student.name)}</div>}
          <div className={styles.identity}><h2>{student.name}</h2>{student.nativeName ? <p dir="auto">{student.nativeName}</p> : null}<dl><div><dt>{text.id}</dt><dd>{student.studentNumber}</dd></div><div><dt>{text.program}</dt><dd>{student.program}</dd></div><div><dt>{text.group}</dt><dd>{student.group}</dd></div></dl></div>
        </div>
        <footer className={styles.cardFooter}><span>{branch}</span><strong>{text.validity}: {student.academicSession}</strong></footer>
      </article>

      <article className={`${styles.card} ${styles.backCard}`}>
        <header className={styles.backHeader}><strong>{workspace.tenantName}</strong><span>{text.reverse}</span></header>
        <dl className={styles.backDetails}>
          <div><dt>{text.id}</dt><dd>{student.studentNumber}</dd></div>
          <div><dt>{text.dob}</dt><dd>{student.dateOfBirth || "—"}</dd></div>
          <div><dt>{text.guardian}</dt><dd>{student.guardian?.name || "—"}</dd></div>
          <div><dt>{text.branch}</dt><dd>{branch}</dd></div>
        </dl>
        <p className={styles.returnNote}>{text.instruction}</p>
        <footer className={styles.backFooter}><span>{workspace.tenantName}</span><span>{student.status}</span></footer>
      </article>
    </section>
  </div>;
}

import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import { getStudentIdCardBatch } from "@/lib/students/id-card-batch";
import styles from "./id-card-batch.module.css";

const copy = {
  en: { kicker: "Student documents", title: "Bulk ID cards", body: "Choose academic session and class, select students, then create an A4 print sheet.", back: "Back to students", session: "Academic session", group: "Class / group", chooseSession: "Choose session", chooseGroup: "Choose class", load: "Load students", students: "Students", empty: "Choose a class to load active students.", none: "No active students found for this class.", create: "Create print sheet", limit: "Maximum 250 students per print batch." },
  ur: { kicker: "طلبہ دستاویزات", title: "بلک ID کارڈز", body: "تعلیمی سیشن اور کلاس منتخب کریں، طلبہ چنیں، پھر A4 پرنٹ شیٹ بنائیں۔", back: "طلبہ پر واپس", session: "تعلیمی سیشن", group: "کلاس / گروپ", chooseSession: "سیشن منتخب کریں", chooseGroup: "کلاس منتخب کریں", load: "طلبہ لوڈ کریں", students: "طلبہ", empty: "فعال طلبہ لوڈ کرنے کے لیے کلاس منتخب کریں۔", none: "اس کلاس میں فعال طلبہ نہیں ملے۔", create: "پرنٹ شیٹ بنائیں", limit: "ایک پرنٹ بیچ میں زیادہ سے زیادہ 250 طلبہ۔" },
  ar: { kicker: "وثائق الطلاب", title: "بطاقات هوية جماعية", body: "اختر السنة والفصل والطلاب، ثم أنشئ ورقة طباعة A4.", back: "العودة للطلاب", session: "السنة الدراسية", group: "الفصل / المجموعة", chooseSession: "اختر السنة", chooseGroup: "اختر الفصل", load: "تحميل الطلاب", students: "الطلاب", empty: "اختر فصلاً لتحميل الطلاب النشطين.", none: "لا يوجد طلاب نشطون في هذا الفصل.", create: "إنشاء ورقة الطباعة", limit: "الحد الأقصى 250 طالبًا لكل دفعة طباعة." }
} as const;

function positive(value: string | undefined): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export default async function BulkIdCardsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ session?: string; group?: string }> }) {
  const locale = (await params).locale as Locale;
  const query = await searchParams;
  const sessionId = positive(query.session);
  const groupId = positive(query.group);
  const result = await getStudentIdCardBatch({ locale, sessionId, groupId });
  const text = copy[locale];
  const groups = sessionId ? result.groups.filter((group) => group.sessionId === sessionId) : [];

  return <>
    <section className="page-heading" data-page-section>
      <div><p className="state-kicker">{text.kicker}</p><h1>{text.title}</h1><p>{text.body}</p></div>
      <Link className="action-button" href={`/${locale}/students`}>{text.back}</Link>
    </section>

    <section className="panel" data-page-section>
      <form className={styles.filterGrid} method="get">
        <label className="field-label">{text.session}<select className="text-field" name="session" defaultValue={sessionId ?? ""} required><option value="">{text.chooseSession}</option>{result.sessions.map((session) => <option value={session.id} key={session.id}>{session.label}</option>)}</select></label>
        <label className="field-label">{text.group}<select className="text-field" name="group" defaultValue={groupId ?? ""} required disabled={!sessionId}><option value="">{text.chooseGroup}</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.label}</option>)}</select></label>
        <button className="action-button" type="submit">{text.load}</button>
      </form>
    </section>

    <section className="panel" data-page-section>
      <div className="section-heading"><div><p className="state-kicker">{text.students}</p><h2>{groupId ? `${result.students.length} / ${result.limit}` : "—"}</h2></div></div>
      {!groupId ? <div className="privacy-callout"><strong>{text.empty}</strong></div> : result.students.length === 0 ? <div className="privacy-callout"><strong>{text.none}</strong></div> : <form method="get" action={`/${locale}/students/id-cards/print`}>
        <input type="hidden" name="session" value={sessionId ?? ""} />
        <input type="hidden" name="group" value={groupId} />
        <div className={styles.studentList}>{result.students.map((student) => <label className={styles.studentChoice} key={student.personId}><input type="checkbox" name="student" value={student.personId} defaultChecked /><span><strong>{student.name}</strong><small>{student.studentNumber} · {student.group}</small></span></label>)}</div>
        <div className={styles.selectionFooter}><small>{text.limit}</small><button className="action-button action-button-primary" type="submit">{text.create}</button></div>
      </form>}
    </section>
  </>;
}

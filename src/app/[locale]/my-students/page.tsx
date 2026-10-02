import Link from "next/link";
import { notFound } from "next/navigation";
import { InlineState } from "@/components/workspace-ui";
import { routing } from "@/i18n/routing";
import type { SupportedLocale } from "@/lib/i18n/config";
import { getMyStudents } from "@/lib/students/my-students";
import styles from "./my-students.module.css";

const copy = {
  en: {
    kicker: "Teaching",
    title: "My Students",
    body: "Students in your currently assigned teaching groups.",
    search: "Search students",
    searchPlaceholder: "Name or student ID",
    group: "Class / group",
    allGroups: "All groups",
    apply: "Apply filters",
    clear: "Clear",
    student: "Student",
    name: "Name",
    groupLabel: "Group",
    profile: "Profile",
    attendance: "Attendance",
    quran: "Qur'an",
    empty: "No active students are assigned to you yet.",
    emptyBody: "Ask the office administrator to assign you to the correct class or Halaqah. Students will appear here automatically after that assignment.",
    noMatch: "No students match these filters.",
    noMatchBody: "Try another name, student ID, or class."
  },
  ur: {
    kicker: "تدریس",
    title: "میرے طلبہ",
    body: "آپ کے موجودہ تدریسی گروپس میں شامل طلبہ۔",
    search: "طلبہ تلاش کریں",
    searchPlaceholder: "نام یا طالب علم ID",
    group: "کلاس / گروپ",
    allGroups: "تمام گروپس",
    apply: "فلٹر لگائیں",
    clear: "صاف کریں",
    student: "طالب علم",
    name: "نام",
    groupLabel: "گروپ",
    profile: "پروفائل",
    attendance: "حاضری",
    quran: "قرآن",
    empty: "ابھی کوئی فعال طالب علم آپ کو مقرر نہیں کیا گیا۔",
    emptyBody: "دفتر کے منتظم سے کہیں کہ آپ کو درست کلاس یا حلقہ مقرر کرے۔ اسائنمنٹ کے بعد طلبہ خود یہاں نظر آئیں گے۔",
    noMatch: "ان فلٹرز سے کوئی طالب علم نہیں ملا۔",
    noMatchBody: "کوئی دوسرا نام، طالب علم ID یا کلاس آزمائیں۔"
  }
} as const;

export default async function MyStudentsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; group?: string }>;
}) {
  const [{ locale: raw }, query] = await Promise.all([params, searchParams]);
  if (!routing.locales.includes(raw as SupportedLocale)) notFound();
  const locale = raw as SupportedLocale;
  const t = copy[locale];
  const students = await getMyStudents(locale);
  const search = (query.q ?? "").trim().slice(0, 120);
  const group = (query.group ?? "").trim().slice(0, 120);
  const groups = [...new Set(students.map((student) => student.group).filter((value) => value && value !== "—"))].sort((a, b) => a.localeCompare(b));
  const normalized = search.toLocaleLowerCase(locale === "ur" ? "ur" : "en");
  const filtered = students.filter((student) => {
    const matchesSearch = !normalized || [student.name, student.nativeName ?? "", student.studentNumber, student.group].some((value) => value.toLocaleLowerCase(locale === "ur" ? "ur" : "en").includes(normalized));
    return matchesSearch && (!group || student.group === group);
  });
  const hasFilters = Boolean(search || group);

  return <>
    <section className="page-heading">
      <div><p className="state-kicker">{t.kicker}</p><h1>{t.title}</h1><p>{t.body}</p></div>
      <span>{filtered.length}{hasFilters ? ` / ${students.length}` : ""}</span>
    </section>
    {students.length ? <form className={styles.filters} method="get">
      <label className="field-label">{t.search}<input className="text-field" type="search" name="q" defaultValue={search} placeholder={t.searchPlaceholder} maxLength={120} /></label>
      <label className="field-label">{t.group}<select className="text-field" name="group" defaultValue={group}><option value="">{t.allGroups}</option>{groups.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <div className={styles.filterActions}><button className="action-button action-button-primary" type="submit">{t.apply}</button>{hasFilters ? <Link className="action-button" href={`/${locale}/my-students`}>{t.clear}</Link> : null}</div>
    </form> : null}
    <section className="professional-card">
      {filtered.length ? <>
        <div className={styles.desktopTable}><div className="data-table-wrap"><table className="data-table"><thead><tr><th>{t.student}</th><th>{t.name}</th><th>{t.groupLabel}</th><th>{t.profile}</th></tr></thead><tbody>{filtered.map((student) => <tr key={student.personId}><td>{student.studentNumber}</td><td><strong>{student.name}</strong>{student.nativeName ? <small dir="auto" className={styles.nativeName}>{student.nativeName}</small> : null}</td><td>{student.group}</td><td><Link className="quiet-link" href={`/${locale}/students/${student.personId}`}>{t.profile}</Link></td></tr>)}</tbody></table></div></div>
        <div className={styles.mobileList}>{filtered.map((student) => <article className={styles.studentCard} key={student.personId}>
          <div className={styles.cardHeading}><div><small>{student.studentNumber}</small><h2>{student.name}</h2>{student.nativeName ? <p dir="auto">{student.nativeName}</p> : null}</div><span className="status-pill">{student.group}</span></div>
          <div className={styles.actions}>
            <Link className="action-button action-button-primary" href={`/${locale}/students/${student.personId}`}>{t.profile}</Link>
            <Link className="action-button" href={`/${locale}/attendance?q=${encodeURIComponent(student.studentNumber)}`}>{t.attendance}</Link>
            <Link className="action-button" href={`/${locale}/quran/${student.personId}`}>{t.quran}</Link>
          </div>
        </article>)}</div>
      </> : <InlineState title={students.length ? t.noMatch : t.empty} body={students.length ? t.noMatchBody : t.emptyBody} action={students.length && hasFilters ? <Link className="action-button" href={`/${locale}/my-students`}>{t.clear}</Link> : undefined} />}
    </section>
  </>;
}

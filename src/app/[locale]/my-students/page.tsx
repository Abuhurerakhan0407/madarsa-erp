import Link from "next/link";
import type { SupportedLocale } from "@/lib/i18n/config";
import { getMyStudents } from "@/lib/students/my-students";

const copy = {
  en: {
    kicker: "Teacher workspace",
    title: "My Students",
    body: "Only students assigned to you through the current branch, timetable, curriculum or teaching assignment are shown here.",
    student: "Student",
    group: "Class / group",
    open: "Open student",
    emptyTitle: "No assigned students",
    emptyBody: "There are no active students inside your verified teaching scope for this branch.",
    attendance: "Open attendance",
    quran: "Open Qur'an & Hifz"
  },
  ur: {
    kicker: "استاد ورک اسپیس",
    title: "میرے طلبہ",
    body: "یہاں صرف اسی برانچ کے وہ طلبہ دکھائے جاتے ہیں جو آپ کے ٹائم ٹیبل، نصاب یا تدریسی ذمہ داری کے ذریعے آپ سے منسلک ہیں۔",
    student: "طالب علم",
    group: "کلاس / گروپ",
    open: "طالب علم کھولیں",
    emptyTitle: "کوئی مقررہ طالب علم نہیں",
    emptyBody: "اس برانچ میں آپ کی تصدیق شدہ تدریسی حدود کے اندر کوئی فعال طالب علم موجود نہیں۔",
    attendance: "حاضری کھولیں",
    quran: "قرآن و حفظ کھولیں"
  }
} as const;

export default async function MyStudentsPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: SupportedLocale = rawLocale === "ur" ? "ur" : "en";
  const t = copy[locale];
  const students = await getMyStudents(locale);

  return (
    <div className="flow-stack">
      <section className="page-heading">
        <div>
          <p className="state-kicker">{t.kicker}</p>
          <h1>{t.title}</h1>
          <p>{t.body}</p>
        </div>
        <div className="quick-actions">
          <Link className="action-button" href={`/${locale}/attendance`}>{t.attendance}</Link>
          <Link className="action-button" href={`/${locale}/quran`}>{t.quran}</Link>
        </div>
      </section>

      {students.length === 0 ? (
        <section className="professional-card">
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyBody}</p>
        </section>
      ) : (
        <section className="professional-card">
          <div className="table-scroll" role="region" aria-label={t.title} tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>{t.student}</th>
                  <th>{t.group}</th>
                  <th aria-label={t.open} />
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.personId}>
                    <td>
                      <strong>{student.name}</strong>
                      {student.nativeName ? <small style={{ display: "block" }}>{student.nativeName}</small> : null}
                      <small style={{ display: "block" }}>{student.studentNumber}</small>
                    </td>
                    <td>{student.group}</td>
                    <td>
                      <Link
                        className="action-button"
                        href={`/${locale}/students/${student.personId}`}
                        aria-label={`${t.open}: ${student.name}`}
                      >
                        {t.open}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

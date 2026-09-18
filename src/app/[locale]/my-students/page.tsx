import Link from "next/link";
import { InlineState, TableFrame, WorkspacePageHeader } from "@/components/workspace-ui";
import type { SupportedLocale } from "@/lib/i18n/config";
import { getMyStudents } from "@/lib/students/my-students";

const copy = {
  en: {
    kicker: "Teacher workspace",
    title: "My Students",
    body: "Only active students assigned to your verified teaching scope are shown here.",
    student: "Student",
    number: "Student ID",
    group: "Class / group",
    open: "Open profile",
    empty: "No assigned students",
    emptyBody: "No active students are currently assigned to your verified teacher scope."
  },
  ur: {
    kicker: "اساتذہ ورک اسپیس",
    title: "میرے طلبہ",
    body: "صرف وہ فعال طلبہ یہاں دکھائے جاتے ہیں جو آپ کے تصدیق شدہ تدریسی دائرہ کار میں مقرر ہیں۔",
    student: "طالب علم",
    number: "طالب علم ID",
    group: "کلاس / گروپ",
    open: "پروفائل کھولیں",
    empty: "کوئی مقرر طالب علم نہیں",
    emptyBody: "آپ کے تصدیق شدہ تدریسی دائرہ کار میں فی الحال کوئی فعال طالب علم مقرر نہیں۔"
  }
} as const;

export default async function MyStudentsPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const rawLocale = (await params).locale;
  const locale: SupportedLocale = rawLocale === "ur" ? "ur" : "en";
  const t = copy[locale];
  const students = await getMyStudents(locale);

  return (
    <>
      <WorkspacePageHeader eyebrow={t.kicker} title={t.title} description={t.body} />
      <section data-page-section>
        {students.length ? (
          <TableFrame label={t.title}>
            <table>
              <thead>
                <tr>
                  <th scope="col">{t.student}</th>
                  <th scope="col">{t.number}</th>
                  <th scope="col">{t.group}</th>
                  <th scope="col">{t.open}</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.personId}>
                    <td data-label={t.student}>
                      <strong>{student.name}</strong>
                      {student.nativeName ? (
                        <>
                          <br />
                          <small dir="auto">{student.nativeName}</small>
                        </>
                      ) : null}
                    </td>
                    <td data-label={t.number}>{student.studentNumber}</td>
                    <td data-label={t.group}>{student.group}</td>
                    <td data-label={t.open}>
                      <Link className="action-button" href={`/${locale}/students/${student.personId}`}>
                        {t.open}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        ) : (
          <InlineState title={t.empty} body={t.emptyBody} />
        )}
      </section>
    </>
  );
}

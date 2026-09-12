import { TaskLanding, WorkspacePageHeader } from "@/components/workspace-ui";
import type { Locale } from "@/lib/i18n/config";

const copy: Record<Locale, { eyebrow: string; title: string; body: string; daily: string; dailyBody: string; students: string; studentsBody: string; attendance: string; attendanceBody: string; quran: string; quranBody: string }> = {
  en: {
    eyebrow: "Teacher workspace",
    title: "Your daily teaching work",
    body: "Open only the student, attendance and Qur'an workspaces assigned to teaching staff.",
    daily: "Today",
    dailyBody: "Start with the work that needs action during the teaching day.",
    students: "My students",
    studentsBody: "Review the students assigned to your teaching work.",
    attendance: "Attendance",
    attendanceBody: "Open today's attendance workspace and mark the students you are allowed to manage.",
    quran: "Qur'an & Hifz",
    quranBody: "Review daily Qur'an progress and revision for your assigned students."
  },
  ur: {
    eyebrow: "استاد ورک اسپیس",
    title: "آپ کا روزانہ تدریسی کام",
    body: "صرف طلبہ، حاضری اور قرآن کے وہ ورک اسپیسز کھولیں جو تدریسی عملے کے لیے ہیں۔",
    daily: "آج",
    dailyBody: "تدریسی دن میں جس کام پر ابھی کارروائی چاہیے، وہیں سے شروع کریں۔",
    students: "میرے طلبہ",
    studentsBody: "اپنے تدریسی کام سے منسلک طلبہ دیکھیں۔",
    attendance: "حاضری",
    attendanceBody: "آج کی حاضری کھولیں اور صرف اجازت یافتہ طلبہ کی حاضری درج کریں۔",
    quran: "قرآن و حفظ",
    quranBody: "اپنے طلبہ کی روزانہ قرآن پیش رفت اور ریویژن دیکھیں۔"
  },
  ar: {
    eyebrow: "مساحة المعلم",
    title: "عملك التدريسي اليومي",
    body: "افتح فقط مساحات الطلاب والحضور والقرآن المخصصة لعمل المعلم.",
    daily: "اليوم",
    dailyBody: "ابدأ بالعمل الذي يحتاج إلى إجراء أثناء يوم التدريس.",
    students: "طلابي",
    studentsBody: "راجع الطلاب المرتبطين بعملك التدريسي.",
    attendance: "الحضور",
    attendanceBody: "افتح حضور اليوم وسجّل الطلاب الذين لديك صلاحية لإدارتهم.",
    quran: "القرآن والحفظ",
    quranBody: "راجع تقدم القرآن والمراجعة اليومية للطلاب المعيّنين لك."
  }
};

export function TeacherHome({ locale, tenantName }: { locale: Locale; tenantName: string }) {
  const text = copy[locale];
  return (
    <>
      <WorkspacePageHeader eyebrow={text.eyebrow} title={text.title} description={`${tenantName} · ${text.body}`} />
      <TaskLanding
        title={text.daily}
        description={text.dailyBody}
        items={[
          { title: text.students, description: text.studentsBody, href: `/${locale}/my-students` },
          { title: text.attendance, description: text.attendanceBody, href: `/${locale}/attendance` },
          { title: text.quran, description: text.quranBody, href: `/${locale}/quran` }
        ]}
      />
    </>
  );
}

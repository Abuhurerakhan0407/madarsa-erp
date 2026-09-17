import Link from "next/link";
import type { SupportedLocale } from "@/lib/i18n/config";
import { formatPortalDate, formatPortalDateTime, localizedPortalText } from "@/lib/portal/locale";
import type { PortalTeacherWorkspace as TeacherWorkspace } from "@/lib/portal/teacher-workspace";

type Raw = Record<string, unknown>;
const rows = (value: unknown): Raw[] => Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Raw[] : [];
const text = (value: unknown): string => typeof value === "string" ? value : "";

const copy = {
  en: {
    kicker: "Teacher portal",
    title: "Teaching workspace",
    assigned: "Assigned students",
    noStudents: "No active students are assigned to this teacher in the linked branches.",
    timetable: "Weekly timetable",
    noTimetable: "No active timetable entries are assigned.",
    weekday: ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    homework: "Homework",
    noHomework: "No recent homework assigned by this teacher.",
    due: "Due",
    quran: "Qur'an / Hifz progress",
    noQuran: "No recent assigned-student recitations recorded by this teacher.",
    academic: "Assigned exams & marks",
    noExams: "No exam subjects are currently assigned to this teacher.",
    maximum: "Maximum marks",
    ownAttendance: "My attendance",
    leave: "My leave",
    noAttendance: "No recent attendance records.",
    noLeave: "No recent leave records.",
    tools: "Teaching tools",
    openStudents: "My students",
    markAttendance: "Attendance",
    openQuran: "Qur'an / Hifz",
    manageHomework: "Homework & timetable",
    enterMarks: "Exams & marks",
    readOnly: "Portal access is read-only for operational actions unless this account also has the corresponding ERP permission.",
    studentNumber: "Student",
    group: "Class",
    program: "Program",
    room: "Room",
    outcome: "Outcome",
    score: "Score",
    state: { active: "Active", on_leave: "On leave", draft: "Draft", published: "Published", closed: "Closed" },
    attendance: { present: "Present", absent: "Absent", late: "Late", leave: "Leave", excused: "Excused", unmarked: "Unmarked" },
    leaveState: { pending: "Pending", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled" }
  },
  ur: {
    kicker: "اساتذہ پورٹل",
    title: "تدریسی ورک اسپیس",
    assigned: "مقرر طلبہ",
    noStudents: "منسلک شاخوں میں اس استاد کے لیے کوئی فعال طالب علم مقرر نہیں۔",
    timetable: "ہفتہ وار ٹائم ٹیبل",
    noTimetable: "کوئی فعال ٹائم ٹیبل اندراج مقرر نہیں۔",
    weekday: ["", "پیر", "منگل", "بدھ", "جمعرات", "جمعہ", "ہفتہ", "اتوار"],
    homework: "گھر کا کام",
    noHomework: "اس استاد کی جانب سے حالیہ کوئی گھر کا کام نہیں۔",
    due: "آخری وقت",
    quran: "قرآن / حفظ پیش رفت",
    noQuran: "اس استاد کی جانب سے مقرر طلبہ کی کوئی حالیہ قرأت درج نہیں۔",
    academic: "مقرر امتحانات اور نمبر",
    noExams: "اس استاد کے لیے فی الحال کوئی امتحانی مضمون مقرر نہیں۔",
    maximum: "زیادہ سے زیادہ نمبر",
    ownAttendance: "میری حاضری",
    leave: "میری رخصت",
    noAttendance: "حالیہ حاضری کا کوئی ریکارڈ نہیں۔",
    noLeave: "حالیہ رخصت کا کوئی ریکارڈ نہیں۔",
    tools: "تدریسی ٹولز",
    openStudents: "میرے طلبہ",
    markAttendance: "حاضری",
    openQuran: "قرآن / حفظ",
    manageHomework: "ہوم ورک اور ٹائم ٹیبل",
    enterMarks: "امتحانات اور نمبر",
    readOnly: "عملی کارروائیاں صرف اس صورت میں دستیاب ہیں جب اسی اکاؤنٹ کے پاس متعلقہ ERP اجازت بھی ہو۔",
    studentNumber: "طالب علم",
    group: "کلاس",
    program: "پروگرام",
    room: "کمرہ",
    outcome: "نتیجہ",
    score: "اسکور",
    state: { active: "فعال", on_leave: "رخصت پر", draft: "مسودہ", published: "شائع شدہ", closed: "بند" },
    attendance: { present: "حاضر", absent: "غیر حاضر", late: "تاخیر", leave: "رخصت", excused: "اجازت یافتہ", unmarked: "درج نہیں" },
    leaveState: { pending: "زیر انتظار", approved: "منظور", rejected: "مسترد", cancelled: "منسوخ" }
  }
} as const;

function localized(value: Raw, locale: SupportedLocale, fallback = "—") {
  return localizedPortalText(value, locale, fallback);
}

export function PortalTeacherWorkspace({
  locale,
  workspace,
  employee
}: {
  locale: SupportedLocale;
  workspace: TeacherWorkspace;
  employee: Raw;
}) {
  const t = copy[locale];
  const attendance = rows(employee.recent_attendance);
  const leave = rows(employee.recent_leave);
  const operational = workspace.capabilities.studentRead || workspace.capabilities.attendanceMark || workspace.capabilities.quranRecord || workspace.capabilities.homeworkManage || workspace.capabilities.marksManage;

  return <div className="flow-stack" data-testid="teacher-portal-workspace">
    <section className="professional-card">
      <div className="section-heading">
        <div>
          <p className="state-kicker">{t.kicker}</p>
          <h2>{t.title}</h2>
          <p>{text(employee.employee_number)}{text(employee.designation) ? ` · ${text(employee.designation)}` : ""}</p>
        </div>
        {operational ? <div className="quick-actions">
          {workspace.capabilities.studentRead ? <Link className="action-button" href={`/${locale}/my-students`}>{t.openStudents}</Link> : null}
          {workspace.capabilities.attendanceMark ? <Link className="action-button action-button-primary" href={`/${locale}/attendance`}>{t.markAttendance}</Link> : null}
          {workspace.capabilities.quranRecord ? <Link className="action-button" href={`/${locale}/quran`}>{t.openQuran}</Link> : null}
          {workspace.capabilities.homeworkManage ? <Link className="action-button" href={`/${locale}/people-academics`}>{t.manageHomework}</Link> : null}
          {workspace.capabilities.marksManage ? <Link className="action-button" href={`/${locale}/exams`}>{t.enterMarks}</Link> : null}
        </div> : null}
      </div>
      <small>{t.readOnly}</small>
    </section>

    <section className="professional-card">
      <h2>{t.assigned}</h2>
      {workspace.students.length ? <div className="demo-card-grid">
        {workspace.students.map((student) => <article className="demo-card" key={`${student.branchId}:${student.enrollmentId}`}>
          <p className="state-kicker">{student.studentNumber}</p>
          <h3>{student.displayName}</h3>
          {student.nativeName ? <p>{student.nativeName}</p> : null}
          <small>{t.program}: {localized(student.programLabels, locale)} · {t.group}: {localized(student.groupLabels, locale)}</small>
          {workspace.capabilities.studentRead ? <div className="quick-actions" style={{ marginTop: 12 }}><Link className="action-button" href={`/${locale}/students/${student.personId}`}>{t.openStudents}</Link></div> : null}
        </article>)}
      </div> : <p>{t.noStudents}</p>}
    </section>

    <section className="professional-card">
      <h2>{t.timetable}</h2>
      {workspace.schedule.length ? <div className="table-wrap"><table>
        <thead><tr><th>{t.weekday[1]}</th><th>{t.group}</th><th>{t.program}</th><th>{t.room}</th></tr></thead>
        <tbody>{workspace.schedule.map((item) => <tr key={`${item.branchId}:${item.id}`}>
          <td>{t.weekday[item.weekday] ?? String(item.weekday)} · {item.startsAt}–{item.endsAt}</td>
          <td>{localized(item.groupLabels, locale)}</td>
          <td>{localized(item.subjectLabels, locale)}</td>
          <td>{item.room ?? "—"}</td>
        </tr>)}</tbody>
      </table></div> : <p>{t.noTimetable}</p>}
    </section>

    <section className="professional-card">
      <h2>{t.homework}</h2>
      {workspace.homework.length ? <div className="demo-card-grid">{workspace.homework.map((item) => <article className="demo-card" key={`${item.branchId}:${item.id}`}>
        <p className="state-kicker">{localized(item.groupLabels, locale)} · {localized(item.subjectLabels, locale)}</p>
        <h3>{typeof item.title === "string" ? item.title : localized(item.title, locale)}</h3>
        <p>{typeof item.instructions === "string" ? item.instructions : localized(item.instructions, locale, "")}</p>
        <small>{t.due} {formatPortalDateTime(item.dueAt, locale)} · {t.state[item.state as keyof typeof t.state] ?? item.state}</small>
      </article>)}</div> : <p>{t.noHomework}</p>}
    </section>

    <section className="professional-card">
      <h2>{t.quran}</h2>
      {workspace.quran.length ? <div className="demo-card-grid">{workspace.quran.map((item) => <article className="demo-card" key={`${item.branchId}:${item.id}`}>
        <p className="state-kicker">{item.studentName}</p>
        <h3>{item.workCategory}</h3>
        <p>{t.outcome}: {item.outcome}{item.overallScore != null ? ` · ${t.score}: ${item.overallScore}%` : ""}</p>
        {item.teacherRemark ? <p>{item.teacherRemark}</p> : null}
        <small>{formatPortalDateTime(item.occurredAt, locale)}</small>
      </article>)}</div> : <p>{t.noQuran}</p>}
    </section>

    <section className="professional-card">
      <div className="section-heading"><div><h2>{t.academic}</h2></div>{workspace.capabilities.marksManage ? <Link className="action-button" href={`/${locale}/exams`}>{t.enterMarks}</Link> : null}</div>
      {workspace.exams.length ? <div className="demo-card-grid">{workspace.exams.map((item) => <article className="demo-card" key={`${item.branchId}:${item.examSubjectId}`}>
        <p className="state-kicker">{localized(item.examLabels, locale)}</p>
        <h3>{localized(item.subjectLabels, locale)}</h3>
        <p>{t.maximum}: {item.maximumMarks} · {t.state[item.state as keyof typeof t.state] ?? item.state}</p>
        <small>{formatPortalDate(item.startsOn, locale)} → {formatPortalDate(item.endsOn, locale)}</small>
      </article>)}</div> : <p>{t.noExams}</p>}
    </section>

    <div className="demo-card-grid">
      <section className="professional-card">
        <h2>{t.ownAttendance}</h2>
        {attendance.length ? attendance.map((item, index) => {
          const status = text(item.status_category) || text(item.status) || "unmarked";
          return <p key={`${text(item.attendance_date)}:${index}`}>{formatPortalDate(item.attendance_date, locale)} · {t.attendance[status as keyof typeof t.attendance] ?? status}</p>;
        }) : <p>{t.noAttendance}</p>}
      </section>
      <section className="professional-card">
        <h2>{t.leave}</h2>
        {leave.length ? leave.map((item, index) => {
          const state = text(item.state);
          return <p key={`${text(item.starts_on)}:${index}`}>{formatPortalDate(item.starts_on, locale)} → {formatPortalDate(item.ends_on, locale)} · {t.leaveState[state as keyof typeof t.leaveState] ?? state}</p>;
        }) : <p>{t.noLeave}</p>}
      </section>
    </div>
  </div>;
}

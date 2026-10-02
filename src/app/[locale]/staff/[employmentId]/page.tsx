import Link from "next/link";
import { notFound } from "next/navigation";
import { TeacherProfileForm } from "@/components/teacher-profile-form";
import { isLocale, type SupportedLocale } from "@/lib/i18n/config";
import type { TeacherLabels } from "@/lib/teachers/workspace";
import { getTeacherByEmploymentId } from "@/lib/teachers/workspace";
import styles from "./page.module.css";

const copy = {
  en: {
    teacher: "Teacher", portal: "Portal", attendanceAction: "Attendance", leaveAction: "Leave", all: "All teachers", profile: "Profile", contactStatus: "Contact & status",
    email: "Email", phone: "Phone", joined: "Joined", account: "Account", lastLogin: "Last login", notAdded: "Not added", never: "Never",
    attendance: "Attendance", last30: "Last 30 days", recorded: "Recorded", present: "Present", absent: "Absent", late: "Late",
    teachingScope: "Teaching scope", assignments: "Assignments", programs: "Programs", subjects: "Subjects / components", groups: "Groups", notAssigned: "Not assigned",
    weekly: "Weekly timetable", periods: "Teaching periods", noPeriods: "No active timetable periods assigned yet.", active: "Active", disabled: "Disabled",
    emailRequired: "Email required", notCreated: "Not created"
  },
  ur: {
    teacher: "استاد", portal: "پورٹل", attendanceAction: "حاضری", leaveAction: "رخصت", all: "تمام اساتذہ", profile: "پروفائل", contactStatus: "رابطہ اور حیثیت",
    email: "ای میل", phone: "فون", joined: "شمولیت", account: "اکاؤنٹ", lastLogin: "آخری لاگ اِن", notAdded: "شامل نہیں", never: "کبھی نہیں",
    attendance: "حاضری", last30: "گزشتہ 30 دن", recorded: "ریکارڈ شدہ", present: "حاضر", absent: "غیر حاضر", late: "تاخیر",
    teachingScope: "تدریسی ذمہ داریاں", assignments: "ذمہ داریاں", programs: "پروگرام", subjects: "مضامین / اجزاء", groups: "کلاس / گروپس", notAssigned: "مقرر نہیں",
    weekly: "ہفتہ وار ٹائم ٹیبل", periods: "تدریسی پیریڈ", noPeriods: "ابھی کوئی فعال تدریسی پیریڈ مقرر نہیں۔", active: "فعال", disabled: "غیر فعال",
    emailRequired: "ای میل درکار", notCreated: "اکاؤنٹ نہیں بنا"
  }
} as const;

const day = {
  en: ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  ur: ["", "پیر", "منگل", "بدھ", "جمعرات", "جمعہ", "ہفتہ", "اتوار"]
} as const;

function label(labels: TeacherLabels, locale: SupportedLocale, fallback: string) {
  if (locale === "ur") return labels.ur || fallback;
  return labels.en || fallback;
}

function accountLabel(status: string, locale: SupportedLocale) {
  const text = copy[locale];
  if (status === "active") return text.active;
  if (status === "disabled") return text.disabled;
  if (status === "email_required") return text.emailRequired;
  return text.notCreated;
}

function designation(key: string, value: string, locale: SupportedLocale) {
  if (locale === "en") return value;
  const urdu: Record<string, string> = {
    teacher: "استاد",
    assistant_teacher: "معاون استاد",
    attendance_supervisor: "حاضری نگران",
    dars_e_nizami_teacher: "درسِ نظامی استاد",
    admissions_coordinator: "داخلہ رابطہ کار",
    hifz_instructor: "حفظ استاد",
    exam_evaluator: "امتحانی ممتحن"
  };
  return urdu[key] || value;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "T";
  const first = parts[0]?.[0] ?? "T";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

function formatDate(value: string | null, locale: SupportedLocale) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale === "ur" ? "ur-PK" : "en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default async function TeacherPage({ params }: { params: Promise<{ locale: string; employmentId: string }> }) {
  const { locale: rawLocale, employmentId: rawId } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  const data = await getTeacherByEmploymentId(id);
  if (!data) notFound();
  const teacher = data.teacher;
  const text = copy[locale];
  const dateLocale = locale === "ur" ? "ur-PK" : "en-US";

  return (
    <div className="flow-stack">
      <section className={`professional-card ${styles.hero}`} data-testid="teacher-detail-hero">
        <div className={styles.identity}>
          <div className={styles.avatar} aria-hidden="true">
            {teacher.photoStoragePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/teachers/photo/${teacher.personId}`} alt="" />
            ) : (
              <span>{initials(teacher.displayName)}</span>
            )}
          </div>
          <div className={styles.identityCopy}>
            <p className="state-kicker">{text.teacher} {teacher.teacherId}</p>
            <h1>{teacher.displayName}</h1>
            {teacher.nameNative ? <p className={styles.nativeName} dir="auto">{teacher.nameNative}</p> : null}
            <p className={styles.designation}>{designation(teacher.designationKey, teacher.designation, locale)}</p>
          </div>
        </div>
        <div className={styles.heroActions}>
          <span className="status-pill">{text.portal}: {accountLabel(teacher.accountStatus, locale)}</span>
          <Link className="action-button" href={`/${locale}/staff/attendance`}>{text.attendanceAction}</Link>
          <Link className="action-button" href={`/${locale}/staff/leave`}>{text.leaveAction}</Link>
          <Link className="action-button" href={`/${locale}/staff`}>{text.all}</Link>
        </div>
      </section>

      <section className={styles.summaryGrid} data-testid="teacher-detail-summary">
        <article className={`professional-card ${styles.summaryCard}`}>
          <div className={styles.cardHeading}>
            <p className="state-kicker">{text.profile}</p>
            <h2>{text.contactStatus}</h2>
          </div>
          <dl className={styles.contactGrid}>
            <div><dt>{text.email}</dt><dd>{teacher.email || text.notAdded}</dd></div>
            <div><dt>{text.phone}</dt><dd>{teacher.phone || text.notAdded}</dd></div>
            <div><dt>{text.joined}</dt><dd>{formatDate(teacher.joinedOn, locale)}</dd></div>
            <div><dt>{text.account}</dt><dd>{accountLabel(teacher.accountStatus, locale)}</dd></div>
            <div className={styles.wideDetail}><dt>{text.lastLogin}</dt><dd>{teacher.lastLogin ? new Date(teacher.lastLogin).toLocaleString(dateLocale) : text.never}</dd></div>
          </dl>
        </article>

        <article className={`professional-card ${styles.summaryCard}`}>
          <div className={styles.cardHeading}>
            <p className="state-kicker">{text.attendance}</p>
            <h2>{text.last30}</h2>
          </div>
          <div className={styles.metricGrid}>
            {[
              [text.recorded, teacher.attendance.total],
              [text.present, teacher.attendance.present],
              [text.absent, teacher.attendance.absent],
              [text.late, teacher.attendance.late]
            ].map(([metricLabel, value]) => (
              <div className={styles.metric} key={String(metricLabel)}>
                <span>{metricLabel}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="professional-card" data-testid="teacher-detail-scope">
        <div className={styles.cardHeading}>
          <p className="state-kicker">{text.teachingScope}</p>
          <h2>{text.assignments}</h2>
        </div>
        <div className={styles.scopeGrid}>
          <article className={styles.scopeCard}>
            <strong>{text.programs}</strong>
            <p>{teacher.assignedPrograms.length ? teacher.assignedPrograms.map((item) => label(item.labels, locale, `${text.programs} ${item.id}`)).join(", ") : text.notAssigned}</p>
          </article>
          <article className={styles.scopeCard}>
            <strong>{text.subjects}</strong>
            <p>{teacher.assignedSubjects.length ? teacher.assignedSubjects.map((item) => label(item.labels, locale, `${text.subjects} ${item.id}`)).join(", ") : text.notAssigned}</p>
          </article>
          <article className={styles.scopeCard}>
            <strong>{text.groups}</strong>
            <p>{teacher.assignedGroups.length ? teacher.assignedGroups.map((item) => label(item.labels, locale, `${text.groups} ${item.id}`)).join(", ") : text.notAssigned}</p>
          </article>
        </div>
      </section>

      <section className="professional-card" data-testid="teacher-detail-timetable">
        <div className={styles.cardHeading}>
          <p className="state-kicker">{text.weekly}</p>
          <h2>{text.periods}</h2>
        </div>
        {teacher.timetable.length ? (
          <div className={styles.timetableGrid}>
            {teacher.timetable.map((slot, index) => (
              <article className={styles.timetableSlot} key={`${slot.weekday}:${slot.startsAt}:${slot.subjectId}:${index}`}>
                <div className={styles.slotTime}>
                  <strong>{day[locale][slot.weekday]}</strong>
                  <span>{slot.startsAt.slice(0, 5)}–{slot.endsAt.slice(0, 5)}</span>
                </div>
                <div className={styles.slotSubject}>
                  <strong>{label(slot.subjectLabels, locale, `${text.subjects} ${slot.subjectId}`)}</strong>
                  <span>{label(slot.groupLabels, locale, `${text.groups} ${slot.groupId}`)}{slot.room ? ` · ${slot.room}` : ""}</span>
                </div>
              </article>
            ))}
          </div>
        ) : <p className={styles.emptyText}>{text.noPeriods}</p>}
      </section>

      {data.canManage ? <TeacherProfileForm teacher={teacher} locale={locale} /> : null}
    </div>
  );
}

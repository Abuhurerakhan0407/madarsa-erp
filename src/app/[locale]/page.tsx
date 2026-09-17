import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupportedLocale } from "@/lib/i18n/config";
import { getOperationalDashboard, type DashboardTrendPoint } from "@/lib/dashboard/workspace";
import { getNavigationAudience } from "@/lib/navigation/audience";
import { getTenantContext } from "@/lib/tenancy/context";

type DashboardPageProps = { params: Promise<{ locale: string }> };

type DashboardCopy = {
  year: string;
  subtitle: string;
  live: string;
  metricsTitle: string;
  metricsBody: string;
  students: string;
  attendance: string;
  attendanceNotStarted: string;
  admissions: string;
  quran: string;
  staff: string;
  exams: string;
  total: string;
  active: string;
  present: string;
  absent: string;
  open: string;
  converted: string;
  revisionDue: string;
  markedToday: string;
  marks: string;
  noExam: string;
  published: string;
  alerts: string;
  alertsBody: string;
  noAlerts: string;
  trends: string;
  trendsBody: string;
  attendanceTrend: string;
  admissionTrend: string;
  quranTrend: string;
  attempts: string;
  quick: string;
  quickBody: string;
  routes: Record<string, string>;
  alertLabels: Record<string, string>;
};

const copy: Record<SupportedLocale, DashboardCopy> = {
  en: {
    year: "Academic year 2026–27",
    subtitle: "Live branch operations across students, admissions, attendance, Qur'an learning, exams, teachers and reporting.",
    live: "Live operations",
    metricsTitle: "Institution overview",
    metricsBody: "These figures come from the same governed records used inside each operational workspace.",
    students: "Active students",
    attendance: "Attendance today",
    attendanceNotStarted: "Not started",
    admissions: "Open admissions",
    quran: "Qur'an / Hifz students",
    staff: "Active teachers",
    exams: "Current exam marks",
    total: "total",
    active: "active",
    present: "present",
    absent: "absent",
    open: "open",
    converted: "converted",
    revisionDue: "revision due",
    markedToday: "attendance marked today",
    marks: "marks recorded",
    noExam: "No active exam",
    published: "published",
    alerts: "Needs attention",
    alertsBody: "Operational items that need a follow-up now.",
    noAlerts: "No active operational alerts.",
    trends: "Last 7 days",
    trendsBody: "Actual branch activity, not presentation data.",
    attendanceTrend: "Student attendance",
    admissionTrend: "Admissions submitted",
    quranTrend: "Qur'an attempts",
    attempts: "attempts",
    quick: "Operational workspaces",
    quickBody: "Open the workspaces used for day-to-day institution operations.",
    routes: { admissions: "Admissions", students: "Students", programs: "Programs & Syllabus", attendance: "Attendance", quran: "Qur'an & Hifz", exams: "Exams & Results", staff: "Teachers", reports: "Reports & Analytics", documents: "IDs & Documents", configuration: "Institution Configuration" },
    alertLabels: { attendance_not_started: "Today's student attendance has not been opened", attendance_unmarked: "Students still unmarked for attendance", admissions_open: "Admission applications need workflow action", quran_revision_due: "Students have Qur'an revision due", staff_leave_pending: "Teacher leave requests are waiting", exam_marks_remaining: "Exam marks still need to be recorded" }
  },
  ur: {
    year: "تعلیمی سال 2026–27",
    subtitle: "طلبہ، داخلہ، حاضری، قرآن، امتحانات، اساتذہ اور رپورٹس کے حقیقی برانچ آپریشنز۔",
    live: "لائیو آپریشنز",
    metricsTitle: "ادارہ جائزہ",
    metricsBody: "یہ اعداد وہی اصل ریکارڈز استعمال کرتے ہیں جو ہر آپریشنل ورک اسپیس میں ہیں۔",
    students: "فعال طلبہ",
    attendance: "آج کی حاضری",
    attendanceNotStarted: "شروع نہیں ہوئی",
    admissions: "کھلے داخلے",
    quran: "قرآن / حفظ طلبہ",
    staff: "فعال اساتذہ",
    exams: "موجودہ امتحانی نمبر",
    total: "کل",
    active: "فعال",
    present: "حاضر",
    absent: "غیر حاضر",
    open: "کھلے",
    converted: "طالب علم بنے",
    revisionDue: "ریویژن باقی",
    markedToday: "آج حاضری درج",
    marks: "نمبر درج",
    noExam: "کوئی فعال امتحان نہیں",
    published: "شائع شدہ",
    alerts: "توجہ درکار",
    alertsBody: "وہ آپریشنل کام جن پر ابھی کارروائی چاہیے۔",
    noAlerts: "کوئی فعال آپریشنل الرٹ نہیں۔",
    trends: "گزشتہ 7 دن",
    trendsBody: "حقیقی برانچ سرگرمی، نمائشی ڈیٹا نہیں۔",
    attendanceTrend: "طلبہ حاضری",
    admissionTrend: "جمع شدہ داخلے",
    quranTrend: "قرآن کوششیں",
    attempts: "کوششیں",
    quick: "آپریشنل ورک اسپیسز",
    quickBody: "ادارے کے روزمرہ کام کے لیے متعلقہ ورک اسپیسز کھولیں۔",
    routes: { admissions: "داخلہ", students: "طلبہ", programs: "پروگرامز و نصاب", attendance: "حاضری", quran: "قرآن و حفظ", exams: "امتحانات و نتائج", staff: "اساتذہ", reports: "رپورٹس و اینالیٹکس", documents: "ID و دستاویزات", configuration: "ادارہ کنفیگریشن" },
    alertLabels: { attendance_not_started: "آج طلبہ کی حاضری شروع نہیں ہوئی", attendance_unmarked: "طلبہ کی حاضری ابھی درج نہیں ہوئی", admissions_open: "داخلہ درخواستوں پر کارروائی باقی ہے", quran_revision_due: "طلبہ کا قرآن ریویژن باقی ہے", staff_leave_pending: "اساتذہ کی رخصت درخواستیں زیر انتظار ہیں", exam_marks_remaining: "امتحانی نمبر ابھی درج کرنا باقی ہیں" }
  }
};

const dateLocales: Record<SupportedLocale, string> = { en: "en-IN", ur: "ur-IN" };

function number(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

function shortDate(date: string, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(dateLocales[locale], { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`));
}

function TrendBars({ points, locale, suffix = "" }: { points: DashboardTrendPoint[]; locale: SupportedLocale; suffix?: string }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <div className="dashboard-bars" role="img" aria-label={points.map((point) => `${shortDate(point.date, locale)} ${point.value}${suffix}`).join(", ")}>
      {points.map((point) => (
        <div className="dashboard-bar-column" key={point.date} title={`${shortDate(point.date, locale)} · ${point.value}${suffix}`}>
          <div className="dashboard-bar-track"><span style={{ height: `${Math.max((point.value / max) * 100, point.value > 0 ? 8 : 2)}%` }} /></div>
          <small>{shortDate(point.date, locale)}</small>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale: rawLocale } = await params;
  const locale: SupportedLocale = rawLocale === "ur" ? "ur" : "en";
  const text = copy[locale];
  const workspace = await getTenantContext();
  if (!workspace) return null;
  const audience = await getNavigationAudience(workspace);
  if (audience === "teacher") redirect(`/${locale}/my-students`);
  if (audience !== "office") return null;
  const dashboard = await getOperationalDashboard(locale);
  const dateLabel = new Intl.DateTimeFormat(dateLocales[locale], { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${dashboard.localDate}T00:00:00.000Z`));
  const operationalRoutes = [
    ["admissions", `/${locale}/admissions`],
    ["students", `/${locale}/students`],
    ["programs", `/${locale}/programs`],
    ["attendance", `/${locale}/attendance`],
    ["quran", `/${locale}/quran`],
    ["exams", `/${locale}/exams`],
    ["staff", `/${locale}/staff`],
    ["reports", `/${locale}/reports`],
    ["documents", `/${locale}/documents`],
    ["configuration", `/${locale}/settings/configuration`]
  ] as const;

  return (
    <div className="operational-dashboard">
      <section className="dashboard-hero" data-page-section>
        <div><div className="dashboard-kickers"><span>{text.year}</span><span className="dashboard-live-dot">{text.live}</span></div><h1>{workspace.tenantName}</h1><p>{text.subtitle}</p></div>
        <time dateTime={dashboard.localDate}>{dateLabel}</time>
      </section>

      <section className="dashboard-section" data-page-section>
        <header className="dashboard-section-heading"><div><h2>{text.metricsTitle}</h2><p>{text.metricsBody}</p></div></header>
        <div className="dashboard-metric-grid">
          <Link className="dashboard-metric dashboard-metric-primary" href={`/${locale}/students`}><span>{text.students}</span><strong>{number(dashboard.students.active)}</strong><small>{number(dashboard.students.total)} {text.total}</small></Link>
          <Link className="dashboard-metric" href={`/${locale}/attendance`}><span>{text.attendance}</span><strong>{dashboard.attendance.rate === null ? text.attendanceNotStarted : `${dashboard.attendance.rate}%`}</strong><small>{number(dashboard.attendance.present)} {text.present} · {number(dashboard.attendance.absent)} {text.absent}</small></Link>
          <Link className="dashboard-metric" href={`/${locale}/admissions`}><span>{text.admissions}</span><strong>{number(dashboard.admissions.open)}</strong><small>{number(dashboard.admissions.total)} {text.total} · {number(dashboard.admissions.converted)} {text.converted}</small></Link>
          <Link className="dashboard-metric" href={`/${locale}/quran`}><span>{text.quran}</span><strong>{number(dashboard.quran.students)}</strong><small>{number(dashboard.quran.revisionDue)} {text.revisionDue}</small></Link>
          <Link className="dashboard-metric" href={`/${locale}/staff`}><span>{text.staff}</span><strong>{number(dashboard.staff.active)}</strong><small>{number(dashboard.staff.attendanceMarkedToday)} {text.markedToday}</small></Link>
          <Link className="dashboard-metric" href={`/${locale}/exams`}><span>{text.exams}</span><strong>{dashboard.exam.label ? `${number(dashboard.exam.marksRecorded)}/${number(dashboard.exam.marksExpected)}` : "—"}</strong><small>{dashboard.exam.label ? `${dashboard.exam.label}${dashboard.exam.published ? ` · ${text.published}` : ""}` : text.noExam}</small></Link>
        </div>
      </section>

      <section className="dashboard-grid" data-page-section>
        <article className="dashboard-panel dashboard-alert-panel"><header><div><h2>{text.alerts}</h2><p>{text.alertsBody}</p></div><span>{dashboard.alerts.length}</span></header>{dashboard.alerts.length ? <div className="dashboard-alert-list">{dashboard.alerts.map((alert) => <Link className={`dashboard-alert dashboard-alert-${alert.severity}`} href={alert.href} key={alert.key}><div><strong>{text.alertLabels[alert.key] ?? alert.key}</strong><small>{alert.count}</small></div><span aria-hidden="true">→</span></Link>)}</div> : <p className="dashboard-empty">{text.noAlerts}</p>}</article>
        <article className="dashboard-panel dashboard-route-panel"><header><div><h2>{text.quick}</h2><p>{text.quickBody}</p></div></header><div className="dashboard-route-grid">{operationalRoutes.map(([key, href]) => <Link href={href} key={key}><span>{text.routes[key]}</span><b aria-hidden="true">↗</b></Link>)}</div></article>
      </section>

      <section className="dashboard-section" data-page-section>
        <header className="dashboard-section-heading"><div><h2>{text.trends}</h2><p>{text.trendsBody}</p></div></header>
        <div className="dashboard-trend-grid">
          <article className="dashboard-panel dashboard-trend-card"><header><div><span>{text.attendanceTrend}</span><strong>{dashboard.attendance.rate === null ? "—" : `${dashboard.attendance.rate}%`}</strong></div></header><TrendBars points={dashboard.trends.attendance} locale={locale} suffix="%" /></article>
          <article className="dashboard-panel dashboard-trend-card"><header><div><span>{text.admissionTrend}</span><strong>{number(dashboard.trends.admissions.reduce((sum, point) => sum + point.value, 0))}</strong></div></header><TrendBars points={dashboard.trends.admissions} locale={locale} /></article>
          <article className="dashboard-panel dashboard-trend-card"><header><div><span>{text.quranTrend}</span><strong>{number(dashboard.trends.quran.reduce((sum, point) => sum + point.value, 0))} {text.attempts}</strong></div></header><TrendBars points={dashboard.trends.quran} locale={locale} /></article>
        </div>
      </section>
    </div>
  );
}

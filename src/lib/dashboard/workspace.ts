import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";
import { getAttendanceTimezone, getDefaultAttendanceDate, getAttendanceWorkspace } from "@/lib/attendance/workspace";
import { getQuranHifzWorkspace } from "@/lib/quran/workspace";
import { getExamWorkspace } from "@/lib/exams/workspace";
import { getHrEmployees } from "@/lib/hr/workspace";
import { getStudentRegister } from "@/lib/students/register";
import { getReportsHub } from "@/lib/reports/workspace";
import type { Locale } from "@/lib/i18n/config";

export type DashboardTrendPoint = { date: string; value: number; secondary?: number | null };
export type DashboardAlert = {
  key: string;
  count: number;
  href: string;
  severity: "attention" | "warning" | "info";
};

export type OperationalDashboard = {
  localDate: string;
  students: { total: number; active: number };
  attendance: {
    started: boolean;
    total: number;
    present: number;
    absent: number;
    late: number;
    leave: number;
    unmarked: number;
    biometric: number;
    nfc: number;
    rate: number | null;
  };
  admissions: { total: number; open: number; accepted: number; converted: number };
  quran: {
    students: number;
    recordedToday: number;
    attemptsToday: number;
    revisionDue: number;
    averageToday: number | null;
  };
  staff: { total: number; active: number; onLeave: number; attendanceMarkedToday: number; leavePending: number };
  exam: {
    label: string | null;
    state: string | null;
    candidates: number;
    marksRecorded: number;
    marksExpected: number;
    averagePercentage: number | null;
    published: boolean;
  };
  reports: { recentRuns: number };
  trends: {
    attendance: DashboardTrendPoint[];
    admissions: DashboardTrendPoint[];
    quran: DashboardTrendPoint[];
  };
  alerts: DashboardAlert[];
};

function dateSeries(endDate: string, days: number): string[] {
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(end.getTime())) return [];
  return Array.from({ length: days }, (_, index) => {
    const value = new Date(end);
    value.setUTCDate(end.getUTCDate() - (days - 1 - index));
    return value.toISOString().slice(0, 10);
  });
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function timestampDateInTimezone(value: string, timezone: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return map.year && map.month && map.day ? `${map.year}-${map.month}-${map.day}` : null;
}

async function loadTrends(args: {
  tenantId: number;
  branchId: number;
  localDate: string;
  timezone: string;
}): Promise<OperationalDashboard["trends"]> {
  const admin = createAdminClient();
  const dates = dateSeries(args.localDate, 7);
  if (!dates.length) return { attendance: [], admissions: [], quran: [] };
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const admissionStart = new Date(`${startDate}T00:00:00.000Z`);
  admissionStart.setUTCDate(admissionStart.getUTCDate() - 1);
  const admissionEnd = new Date(`${endDate}T00:00:00.000Z`);
  admissionEnd.setUTCDate(admissionEnd.getUTCDate() + 2);

  const [sessionResult, admissionsResult, quranSessionResult] = await Promise.all([
    admin
      .from("attendance_sessions")
      .select("id,attendance_date")
      .eq("tenant_id", args.tenantId)
      .eq("branch_id", args.branchId)
      .gte("attendance_date", startDate)
      .lte("attendance_date", endDate),
    admin
      .from("applications")
      .select("submitted_at")
      .eq("tenant_id", args.tenantId)
      .eq("branch_id", args.branchId)
      .gte("submitted_at", admissionStart.toISOString())
      .lt("submitted_at", admissionEnd.toISOString()),
    admin
      .from("recitation_sessions")
      .select("id,session_date")
      .eq("tenant_id", args.tenantId)
      .eq("branch_id", args.branchId)
      .gte("session_date", startDate)
      .lte("session_date", endDate)
  ]);

  if (sessionResult.error) throw new Error(`Unable to load attendance trend: ${sessionResult.error.message}`);
  if (admissionsResult.error) throw new Error(`Unable to load admissions trend: ${admissionsResult.error.message}`);
  if (quranSessionResult.error) throw new Error(`Unable to load Qur'an trend: ${quranSessionResult.error.message}`);

  const attendanceSessions = sessionResult.data ?? [];
  const quranSessions = quranSessionResult.data ?? [];

  const [attendanceRecordsResult, quranAttemptsResult] = await Promise.all([
    attendanceSessions.length
      ? admin
          .from("attendance_records")
          .select("attendance_session_id,presence_ratio")
          .eq("tenant_id", args.tenantId)
          .in("attendance_session_id", attendanceSessions.map((row) => row.id))
      : Promise.resolve({ data: [], error: null }),
    quranSessions.length
      ? admin
          .from("recitation_attempts")
          .select("recitation_session_id,overall_score")
          .eq("tenant_id", args.tenantId)
          .in("recitation_session_id", quranSessions.map((row) => row.id))
      : Promise.resolve({ data: [], error: null })
  ]);

  if (attendanceRecordsResult.error) throw new Error(`Unable to load attendance trend records: ${attendanceRecordsResult.error.message}`);
  if (quranAttemptsResult.error) throw new Error(`Unable to load Qur'an trend attempts: ${quranAttemptsResult.error.message}`);

  const attendanceDateBySession = new Map(attendanceSessions.map((row) => [row.id, row.attendance_date]));
  const quranDateBySession = new Map(quranSessions.map((row) => [row.id, row.session_date]));
  const attendanceBuckets = new Map<string, { sum: number; total: number }>();
  const admissionsBuckets = new Map<string, number>();
  const quranBuckets = new Map<string, { attempts: number; scoreSum: number; scored: number }>();
  const permittedDates = new Set(dates);

  for (const row of attendanceRecordsResult.data ?? []) {
    const date = attendanceDateBySession.get(row.attendance_session_id);
    if (!date) continue;
    const bucket = attendanceBuckets.get(date) ?? { sum: 0, total: 0 };
    const ratio = Number(row.presence_ratio ?? 0);
    bucket.sum += Number.isFinite(ratio) ? ratio : 0;
    bucket.total += 1;
    attendanceBuckets.set(date, bucket);
  }

  for (const row of admissionsResult.data ?? []) {
    if (!row.submitted_at) continue;
    const date = timestampDateInTimezone(row.submitted_at, args.timezone);
    if (!date || !permittedDates.has(date)) continue;
    admissionsBuckets.set(date, (admissionsBuckets.get(date) ?? 0) + 1);
  }

  for (const row of quranAttemptsResult.data ?? []) {
    const date = quranDateBySession.get(row.recitation_session_id);
    if (!date) continue;
    const bucket = quranBuckets.get(date) ?? { attempts: 0, scoreSum: 0, scored: 0 };
    bucket.attempts += 1;
    const score = Number(row.overall_score);
    if (Number.isFinite(score)) {
      bucket.scoreSum += score;
      bucket.scored += 1;
    }
    quranBuckets.set(date, bucket);
  }

  return {
    attendance: dates.map((date) => {
      const bucket = attendanceBuckets.get(date);
      return { date, value: bucket?.total ? round((bucket.sum / bucket.total) * 100) : 0 };
    }),
    admissions: dates.map((date) => ({ date, value: admissionsBuckets.get(date) ?? 0 })),
    quran: dates.map((date) => {
      const bucket = quranBuckets.get(date);
      return {
        date,
        value: bucket?.attempts ?? 0,
        secondary: bucket?.scored ? round(bucket.scoreSum / bucket.scored) : null
      };
    })
  };
}

export async function getOperationalDashboard(locale: Locale): Promise<OperationalDashboard> {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) throw new Error("Active branch is required.");

  const [localDate, timezone] = await Promise.all([getDefaultAttendanceDate(), getAttendanceTimezone()]);
  const [students, attendance, quran, staff, exam, reports, applicationsResult, trends] = await Promise.all([
    getStudentRegister({ locale, page: 1, pageSize: 1 }),
    getAttendanceWorkspace({ date: localDate, locale, page: 1, pageSize: 1 }),
    getQuranHifzWorkspace({ page: 1, pageSize: 1 }),
    getHrEmployees({ page: 1, pageSize: 1 }),
    getExamWorkspace(),
    getReportsHub(),
    createAdminClient()
      .from("applications")
      .select("state")
      .eq("tenant_id", workspace.tenantId)
      .eq("branch_id", workspace.branchId),
    loadTrends({ tenantId: workspace.tenantId, branchId: workspace.branchId, localDate, timezone })
  ]);

  if (applicationsResult.error) throw new Error(`Unable to load admissions summary: ${applicationsResult.error.message}`);
  const applicationStates = (applicationsResult.data ?? []).map((row) => row.state ?? "submitted");
  const converted = applicationStates.filter((state) => state === "converted").length;
  const accepted = applicationStates.filter((state) => state === "accepted").length;
  const closedStates = new Set(["converted", "rejected", "withdrawn", "expired"]);
  const open = applicationStates.filter((state) => !closedStates.has(state)).length;
  const attendanceMarked = attendance.summary.present + attendance.summary.absent + attendance.summary.late + attendance.summary.leave;
  const currentAttendanceTrend = trends.attendance.find((point) => point.date === localDate);
  const attendanceRate = attendance.started && attendanceMarked > 0 ? currentAttendanceTrend?.value ?? null : null;
  const marksRemaining = Math.max(exam.summary.marksExpected - exam.summary.marksRecorded, 0);

  const alerts: DashboardAlert[] = [];
  if (!attendance.started) alerts.push({ key: "attendance_not_started", count: 1, href: `/${locale}/attendance`, severity: "warning" });
  else if (attendance.summary.unmarked > 0) alerts.push({ key: "attendance_unmarked", count: attendance.summary.unmarked, href: `/${locale}/attendance`, severity: "warning" });
  if (open > 0) alerts.push({ key: "admissions_open", count: open, href: `/${locale}/admissions`, severity: "attention" });
  if (quran.summary.revisionDue > 0) alerts.push({ key: "quran_revision_due", count: quran.summary.revisionDue, href: `/${locale}/quran/revision`, severity: "attention" });
  if (staff.summary.leavePending > 0) alerts.push({ key: "staff_leave_pending", count: staff.summary.leavePending, href: `/${locale}/staff/leave`, severity: "info" });
  if (exam.exam && marksRemaining > 0) alerts.push({ key: "exam_marks_remaining", count: marksRemaining, href: `/${locale}/exams`, severity: "attention" });

  return {
    localDate,
    students: { total: students.total, active: students.active },
    attendance: {
      started: attendance.started,
      total: attendance.summary.total,
      present: attendance.summary.present,
      absent: attendance.summary.absent,
      late: attendance.summary.late,
      leave: attendance.summary.leave,
      unmarked: attendance.summary.unmarked,
      biometric: attendance.summary.biometric,
      nfc: attendance.summary.nfc,
      rate: attendanceRate
    },
    admissions: { total: applicationStates.length, open, accepted, converted },
    quran: {
      students: quran.summary.students,
      recordedToday: quran.summary.recordedToday,
      attemptsToday: quran.summary.attemptsToday,
      revisionDue: quran.summary.revisionDue,
      averageToday: quran.summary.averageToday
    },
    staff: {
      total: staff.summary.total,
      active: staff.summary.active,
      onLeave: staff.summary.onLeave,
      attendanceMarkedToday: staff.summary.attendanceMarkedToday,
      leavePending: staff.summary.leavePending
    },
    exam: {
      label: exam.exam?.label ?? null,
      state: exam.exam?.state ?? null,
      candidates: exam.summary.candidates,
      marksRecorded: exam.summary.marksRecorded,
      marksExpected: exam.summary.marksExpected,
      averagePercentage: exam.summary.averagePercentage,
      published: Boolean(exam.latestResult?.publishedAt)
    },
    reports: { recentRuns: reports.recentRuns.length },
    trends,
    alerts
  };
}

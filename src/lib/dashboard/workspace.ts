import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";
import { getDefaultAttendanceDate, getAttendanceWorkspace } from "@/lib/attendance/workspace";
import { getQuranHifzWorkspace } from "@/lib/quran/workspace";
import { getExamWorkspace } from "@/lib/exams/workspace";
import { getHrEmployees } from "@/lib/hr/workspace";
import { getStudentRegister } from "@/lib/students/register";
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
  trends: {
    attendance: DashboardTrendPoint[];
    admissions: DashboardTrendPoint[];
    quran: DashboardTrendPoint[];
  };
  alerts: DashboardAlert[];
};

type Raw = Record<string, unknown>;

function object(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function trend(value: unknown): DashboardTrendPoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = object(entry);
    if (typeof row.date !== "string") return [];
    const secondary = row.secondary === null || row.secondary === undefined ? null : number(row.secondary);
    return [{ date: row.date, value: number(row.value), secondary }];
  });
}

async function getDashboardAggregate(args: {
  identityId: string;
  tenantId: number;
  branchId: number;
  localDate: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_operational_dashboard_aggregate_v1", {
    p_identity_id: args.identityId,
    p_tenant_id: args.tenantId,
    p_branch_id: args.branchId,
    p_local_date: args.localDate
  });
  if (error) throw new Error(`Unable to load dashboard analytics: ${error.message}`);
  const raw = object(data);
  const admissions = object(raw.admissions);
  const trends = object(raw.trends);
  return {
    admissions: {
      total: number(admissions.total),
      open: number(admissions.open),
      accepted: number(admissions.accepted),
      converted: number(admissions.converted)
    },
    trends: {
      attendance: trend(trends.attendance),
      admissions: trend(trends.admissions),
      quran: trend(trends.quran)
    }
  };
}

export async function getOperationalDashboard(locale: Locale): Promise<OperationalDashboard> {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) throw new Error("Active branch is required.");

  const localDate = await getDefaultAttendanceDate();
  const [students, attendance, quran, staff, exam, aggregate] = await Promise.all([
    getStudentRegister({ locale, page: 1, pageSize: 1 }),
    getAttendanceWorkspace({ date: localDate, locale, page: 1, pageSize: 1 }),
    getQuranHifzWorkspace({ page: 1, pageSize: 1 }),
    getHrEmployees({ page: 1, pageSize: 1 }),
    getExamWorkspace(),
    getDashboardAggregate({
      identityId: workspace.identityId,
      tenantId: workspace.tenantId,
      branchId: workspace.branchId,
      localDate
    })
  ]);

  const attendanceMarked = attendance.summary.present + attendance.summary.absent + attendance.summary.late + attendance.summary.leave;
  const currentAttendanceTrend = aggregate.trends.attendance.find((point) => point.date === localDate);
  const attendanceRate = attendance.started && attendanceMarked > 0 ? currentAttendanceTrend?.value ?? null : null;
  const marksRemaining = Math.max(exam.summary.marksExpected - exam.summary.marksRecorded, 0);

  const alerts: DashboardAlert[] = [];
  if (!attendance.started) alerts.push({ key: "attendance_not_started", count: 1, href: `/${locale}/attendance`, severity: "warning" });
  else if (attendance.summary.unmarked > 0) alerts.push({ key: "attendance_unmarked", count: attendance.summary.unmarked, href: `/${locale}/attendance`, severity: "warning" });
  if (aggregate.admissions.open > 0) alerts.push({ key: "admissions_open", count: aggregate.admissions.open, href: `/${locale}/admissions`, severity: "attention" });
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
    admissions: aggregate.admissions,
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
    trends: aggregate.trends,
    alerts
  };
}

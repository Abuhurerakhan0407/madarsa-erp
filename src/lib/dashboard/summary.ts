import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenancy/context";

const DEFAULT_TIME_ZONE = "Asia/Kolkata";
const DEFAULT_CURRENCY = "INR";

export type ProgramAttendance = {
  id: number;
  key: string;
  label: string;
  value: number;
};

export type DashboardSummary = {
  tenantName: string;
  displayName: string;
  dateKey: string;
  timeZone: string;
  activeStudents: number;
  presentToday: number;
  feesReceivedToday: number;
  currencyCode: string;
  pendingReviews: number;
  attendanceByProgram: ProgramAttendance[];
};

type ProgramRow = {
  id: number;
  key: string;
  labels: Record<string, string> | null;
};

type AttendanceRow = {
  enrollment_id: number | null;
  presence_ratio: number | string | null;
};

type EnrollmentRow = {
  id: number;
  program_id: number | null;
};

export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function aggregateProgramAttendance(
  programs: ProgramRow[],
  records: AttendanceRow[],
  enrollments: EnrollmentRow[],
  locale: string
): ProgramAttendance[] {
  const enrollmentProgram = new Map(
    enrollments.map((enrollment) => [enrollment.id, enrollment.program_id])
  );
  const totals = new Map<number, { sum: number; count: number }>();

  for (const record of records) {
    if (!record.enrollment_id) continue;
    const programId = enrollmentProgram.get(record.enrollment_id);
    if (!programId) continue;

    const ratio = Number(record.presence_ratio ?? 0);
    if (!Number.isFinite(ratio)) continue;

    const current = totals.get(programId) ?? { sum: 0, count: 0 };
    current.sum += Math.max(0, Math.min(1, ratio));
    current.count += 1;
    totals.set(programId, current);
  }

  return programs
    .map((program) => {
      const total = totals.get(program.id);
      const value = total?.count ? Math.round((total.sum / total.count) * 100) : 0;
      const label =
        program.labels?.[locale] ??
        program.labels?.en ??
        Object.values(program.labels ?? {})[0] ??
        program.key;

      return { id: program.id, key: program.key, label, value };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function getDashboardSummary(locale: string): Promise<DashboardSummary> {
  const workspace = await getTenantContext();
  if (!workspace) {
    throw new Error("Tenant context is required for dashboard data.");
  }

  const supabase = await createClient();
  const { data: institution, error: institutionError } = await supabase
    .from("institution_profiles")
    .select("timezone")
    .eq("tenant_id", workspace.tenantId)
    .maybeSingle();

  if (institutionError) {
    throw new Error(`Unable to load institution profile: ${institutionError.message}`);
  }

  const timeZone = institution?.timezone || DEFAULT_TIME_ZONE;
  const dateKey = dateKeyInTimeZone(new Date(), timeZone);

  const [students, reviews, payments, sessions, programs] = await Promise.all([
    supabase
      .from("student_profiles")
      .select("person_id", { count: "exact", head: true })
      .eq("tenant_id", workspace.tenantId)
      .eq("status", "active"),
    supabase
      .from("application_reviews")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", workspace.tenantId)
      .eq("outcome", "pending"),
    supabase
      .from("payments")
      .select("amount,currency_code")
      .eq("tenant_id", workspace.tenantId)
      .eq("payment_date", dateKey)
      .in("state", ["verified", "posted"]),
    supabase
      .from("attendance_sessions")
      .select("id")
      .eq("tenant_id", workspace.tenantId)
      .eq("attendance_date", dateKey)
      .in("context_type", ["student_daily", "student_period"])
      .neq("state", "cancelled"),
    supabase
      .from("programs")
      .select("id,key,labels")
      .eq("tenant_id", workspace.tenantId)
      .eq("status", "active")
  ]);

  const failures = [
    ["students", students.error],
    ["reviews", reviews.error],
    ["payments", payments.error],
    ["attendance sessions", sessions.error],
    ["programs", programs.error]
  ] as const;

  for (const [label, error] of failures) {
    if (error) throw new Error(`Unable to load dashboard ${label}: ${error.message}`);
  }

  const sessionIds = (sessions.data ?? []).map((session) => session.id);
  let attendanceRows: AttendanceRow[] = [];
  let enrollmentRows: EnrollmentRow[] = [];

  if (sessionIds.length > 0) {
    const { data, error } = await supabase
      .from("attendance_records")
      .select("enrollment_id,presence_ratio")
      .eq("tenant_id", workspace.tenantId)
      .in("attendance_session_id", sessionIds)
      .not("enrollment_id", "is", null);

    if (error) {
      throw new Error(`Unable to load dashboard attendance records: ${error.message}`);
    }

    attendanceRows = data ?? [];
    const enrollmentIds = Array.from(
      new Set(attendanceRows.flatMap((record) => record.enrollment_id ?? []))
    );

    if (enrollmentIds.length > 0) {
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from("enrollments")
        .select("id,program_id")
        .eq("tenant_id", workspace.tenantId)
        .in("id", enrollmentIds);

      if (enrollmentError) {
        throw new Error(`Unable to load dashboard enrollments: ${enrollmentError.message}`);
      }

      enrollmentRows = enrollmentData ?? [];
    }
  }

  const presentToday = attendanceRows.reduce((count, record) => {
    return count + (Number(record.presence_ratio ?? 0) > 0 ? 1 : 0);
  }, 0);

  const paymentRows = payments.data ?? [];
  const currencies = new Set(paymentRows.map((payment) => payment.currency_code));
  const currencyCode = currencies.size === 1 ? Array.from(currencies)[0] : DEFAULT_CURRENCY;
  const feesReceivedToday = paymentRows
    .filter((payment) => payment.currency_code === currencyCode)
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

  return {
    tenantName: workspace.tenantName,
    displayName: workspace.displayName,
    dateKey,
    timeZone,
    activeStudents: students.count ?? 0,
    presentToday,
    feesReceivedToday,
    currencyCode,
    pendingReviews: reviews.count ?? 0,
    attendanceByProgram: aggregateProgramAttendance(
      (programs.data ?? []) as ProgramRow[],
      attendanceRows,
      enrollmentRows,
      locale
    )
  };
}

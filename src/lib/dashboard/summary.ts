import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenancy/context";
import {
  aggregateProgramAttendance,
  dateKeyInTimeZone,
  type AttendanceRow,
  type EnrollmentRow,
  type ProgramAttendance,
  type ProgramRow
} from "./summary-helpers";

const DEFAULT_TIME_ZONE = "Asia/Kolkata";
const DEFAULT_CURRENCY = "INR";

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

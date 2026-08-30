import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";
import type { Locale } from "@/lib/i18n/config";

export type AttendanceWorkspaceStatus = {
  key: string;
  category: string;
  presenceRatio: number;
  triggersAlert: boolean;
};

export type AttendanceWorkspaceRow = {
  personId: number;
  name: string;
  nameNative: string | null;
  studentNumber: string;
  groupId: number | null;
  groupName: string | null;
  attendanceRecordId: number | null;
  statusKey: string | null;
  statusCategory: string | null;
  originalStatusKey: string | null;
  originalStatusCategory: string | null;
  source: "manual" | "biometric" | "nfc" | "import" | null;
  sourceRef: string | null;
  markedAt: string | null;
  note: string | null;
  approvedCorrectionId: number | null;
  approvedCorrectionReason: string | null;
  pendingCorrectionId: number | null;
  pendingStatusKey: string | null;
  pendingCorrectionReason: string | null;
};

export type AttendanceWorkspace = {
  date: string;
  timezone: string;
  started: boolean;
  sessionId: number | null;
  rosterId: number | null;
  state: string;
  statuses: AttendanceWorkspaceStatus[];
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    leave: number;
    unmarked: number;
    biometric: number;
    nfc: number;
    pendingCorrections: number;
  };
  total: number;
  page: number;
  pageSize: number;
  rows: AttendanceWorkspaceRow[];
};

type RawWorkspace = {
  attendance_date?: unknown;
  started?: unknown;
  session_id?: unknown;
  roster_id?: unknown;
  state?: unknown;
  statuses?: unknown;
  summary?: unknown;
  total?: unknown;
  page?: unknown;
  page_size?: unknown;
  rows?: unknown;
};

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapRows(value: unknown): AttendanceWorkspaceRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const personId = numberValue(row.person_id);
    if (!personId) return [];
    return [{
      personId,
      name: stringValue(row.name) ?? "Student",
      nameNative: stringValue(row.name_native),
      studentNumber: stringValue(row.student_number) ?? "—",
      groupId: numberValue(row.group_id),
      groupName: stringValue(row.group_name),
      attendanceRecordId: numberValue(row.attendance_record_id),
      statusKey: stringValue(row.status_key),
      statusCategory: stringValue(row.status_category),
      originalStatusKey: stringValue(row.original_status_key),
      originalStatusCategory: stringValue(row.original_status_category),
      source: row.source === "manual" || row.source === "biometric" || row.source === "nfc" || row.source === "import" ? row.source : null,
      sourceRef: stringValue(row.source_ref),
      markedAt: stringValue(row.marked_at),
      note: stringValue(row.note),
      approvedCorrectionId: numberValue(row.approved_correction_id),
      approvedCorrectionReason: stringValue(row.approved_correction_reason),
      pendingCorrectionId: numberValue(row.pending_correction_id),
      pendingStatusKey: stringValue(row.pending_status_key),
      pendingCorrectionReason: stringValue(row.pending_correction_reason)
    }];
  });
}

function mapStatuses(value: unknown): AttendanceWorkspaceStatus[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const key = stringValue(row.key);
    const category = stringValue(row.category);
    if (!key || !category) return [];
    return [{ key, category, presenceRatio: Number(row.presenceRatio ?? 0), triggersAlert: row.triggersAlert === true }];
  });
}

function dateInTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export async function getAttendanceTimezone(): Promise<string> {
  const workspace = await getTenantContext();
  if (!workspace) return "UTC";
  const admin = createAdminClient();
  const { data } = await admin.from("institution_profiles").select("timezone").eq("tenant_id", workspace.tenantId).maybeSingle();
  return typeof data?.timezone === "string" && data.timezone.trim() ? data.timezone : "UTC";
}

export async function getDefaultAttendanceDate(): Promise<string> {
  return dateInTimezone(await getAttendanceTimezone());
}

export async function getAttendanceWorkspace(args: { date: string; search?: string; page?: number; pageSize?: number; locale: Locale }): Promise<AttendanceWorkspace> {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) throw new Error("Active branch is required.");
  const timezone = await getAttendanceTimezone();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_student_attendance_workspace", {
    p_identity_id: workspace.identityId,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_attendance_date: args.date,
    p_search: args.search?.trim() || null,
    p_page: args.page ?? 1,
    p_page_size: args.pageSize ?? 50
  });
  if (error) throw new Error(`Unable to load attendance: ${error.message}`);
  const raw = data && typeof data === "object" && !Array.isArray(data) ? data as RawWorkspace : {};
  const summary = raw.summary && typeof raw.summary === "object" && !Array.isArray(raw.summary) ? raw.summary as Record<string, unknown> : {};
  return {
    date: stringValue(raw.attendance_date) ?? args.date,
    timezone,
    started: raw.started === true,
    sessionId: numberValue(raw.session_id),
    rosterId: numberValue(raw.roster_id),
    state: stringValue(raw.state) ?? "not_started",
    statuses: mapStatuses(raw.statuses),
    summary: {
      total: Number(summary.total ?? 0),
      present: Number(summary.present ?? 0),
      absent: Number(summary.absent ?? 0),
      late: Number(summary.late ?? 0),
      leave: Number(summary.leave ?? 0),
      unmarked: Number(summary.unmarked ?? 0),
      biometric: Number(summary.biometric ?? 0),
      nfc: Number(summary.nfc ?? 0),
      pendingCorrections: Number(summary.pending_corrections ?? 0)
    },
    total: Number(raw.total ?? 0),
    page: Number(raw.page ?? args.page ?? 1),
    pageSize: Number(raw.page_size ?? args.pageSize ?? 50),
    rows: mapRows(raw.rows)
  };
}

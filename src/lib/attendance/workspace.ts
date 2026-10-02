import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";
import type { Locale } from "@/lib/i18n/config";

export type AttendanceWorkspaceStatus = { key: string; category: string; presenceRatio: number; triggersAlert: boolean };
export type AttendanceCapabilities = { canMark: boolean; canCorrect: boolean; canApprove: boolean; canViewStaff: boolean };
export type EmergencyAttendanceAuthorization={id:number;attendanceDate:string;subjectType:"student"|"staff";scopeType:"branch"|"group"|"student"|"teacher";groupId:number|null;studentPersonId:number|null;employmentId:number|null;reason:string;startsAt:string;expiresAt:string;state:string;active:boolean;scopeLabel:string};
export type AttendanceTrendPoint={date:string;recorded:number;attendancePercent:number};

export type AttendanceWorkspaceRow = {
  personId: number; name: string; nameNative: string | null; studentNumber: string; groupId: number | null; groupName: string | null;
  attendanceRecordId: number | null; statusKey: string | null; statusCategory: string | null; originalStatusKey: string | null; originalStatusCategory: string | null;
  source: "manual" | "biometric" | "nfc" | "import" | null; sourceRef: string | null; markedAt: string | null; note: string | null;
  approvedCorrectionId: number | null; approvedCorrectionReason: string | null; pendingCorrectionId: number | null; pendingStatusKey: string | null; pendingCorrectionReason: string | null;
  firstScan:string|null;lastScan:string|null;deviceLabel:string|null;modality:string|null;emergencyManualAuthorized:boolean;
};

export type AttendanceWorkspace = {
  date: string; timezone: string; started: boolean; sessionId: number | null; rosterId: number | null; state: string; statuses: AttendanceWorkspaceStatus[];
  capabilities: AttendanceCapabilities;
  summary: { total: number; present: number; absent: number; late: number; leave: number; unmarked: number; biometric: number; nfc: number; pendingCorrections: number };
  insights:{dailyPercent:number;weeklyPercent:number;monthlyPercent:number;trend:AttendanceTrendPoint[]};
  emergency:{canManage:boolean;authorizations:EmergencyAttendanceAuthorization[]};
  total: number; page: number; pageSize: number; rows: AttendanceWorkspaceRow[];
};

type RawWorkspace = { attendance_date?: unknown; started?: unknown; session_id?: unknown; roster_id?: unknown; state?: unknown; statuses?: unknown; summary?: unknown; total?: unknown; page?: unknown; page_size?: unknown; rows?: unknown };
type Raw=Record<string,unknown>;
function objectValue(value:unknown):Raw{return value&&typeof value==="object"&&!Array.isArray(value)?value as Raw:{};}
function arrayValue(value:unknown):Raw[]{return Array.isArray(value)?value.filter((item)=>item&&typeof item==="object"&&!Array.isArray(item)) as Raw[]:[];}
function stringValue(value: unknown): string | null { return typeof value === "string" ? value : null; }
function numberValue(value: unknown): number | null { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function boolValue(value:unknown):boolean{return value===true;}

function mapRows(value: unknown): AttendanceWorkspaceRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>; const personId = numberValue(row.person_id); if (!personId) return [];
    return [{ personId, name: stringValue(row.name) ?? "Student", nameNative: stringValue(row.name_native), studentNumber: stringValue(row.student_number) ?? "—", groupId: numberValue(row.group_id), groupName: stringValue(row.group_name), attendanceRecordId: numberValue(row.attendance_record_id), statusKey: stringValue(row.status_key), statusCategory: stringValue(row.status_category), originalStatusKey: stringValue(row.original_status_key), originalStatusCategory: stringValue(row.original_status_category), source: row.source === "manual" || row.source === "biometric" || row.source === "nfc" || row.source === "import" ? row.source : null, sourceRef: stringValue(row.source_ref), markedAt: stringValue(row.marked_at), note: stringValue(row.note), approvedCorrectionId: numberValue(row.approved_correction_id), approvedCorrectionReason: stringValue(row.approved_correction_reason), pendingCorrectionId: numberValue(row.pending_correction_id), pendingStatusKey: stringValue(row.pending_status_key), pendingCorrectionReason: stringValue(row.pending_correction_reason),firstScan:null,lastScan:null,deviceLabel:null,modality:null,emergencyManualAuthorized:false }];
  });
}
function mapStatuses(value: unknown): AttendanceWorkspaceStatus[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => { if (!item || typeof item !== "object" || Array.isArray(item)) return []; const row = item as Record<string, unknown>; const key = stringValue(row.key); const category = stringValue(row.category); if (!key || !category) return []; return [{ key, category, presenceRatio: Number(row.presenceRatio ?? 0), triggersAlert: row.triggersAlert === true }]; });
}
function mapEmergency(value:unknown):EmergencyAttendanceAuthorization[]{return arrayValue(value).flatMap((r)=>{const id=numberValue(r.id),subjectType=stringValue(r.subject_type),scopeType=stringValue(r.scope_type),attendanceDate=stringValue(r.attendance_date),startsAt=stringValue(r.starts_at),expiresAt=stringValue(r.expires_at);if(!id||!attendanceDate||!startsAt||!expiresAt||(subjectType!=="student"&&subjectType!=="staff")||!scopeType||!["branch","group","student","teacher"].includes(scopeType))return[];return[{id,attendanceDate,subjectType,scopeType:scopeType as EmergencyAttendanceAuthorization["scopeType"],groupId:numberValue(r.group_id),studentPersonId:numberValue(r.student_person_id),employmentId:numberValue(r.employment_id),reason:stringValue(r.reason)??"Emergency manual attendance",startsAt,expiresAt,state:stringValue(r.state)??"active",active:boolValue(r.active),scopeLabel:stringValue(r.scope_label)??"Entire branch"}];});}
function mapTrend(value:unknown):AttendanceTrendPoint[]{return arrayValue(value).flatMap((r)=>{const date=stringValue(r.attendance_date);if(!date)return[];return[{date,recorded:numberValue(r.recorded)??0,attendancePercent:numberValue(r.attendance_percent)??0}];});}
function dateInTimezone(timezone: string): string { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const map = Object.fromEntries(parts.map((part) => [part.type, part.value])); return `${map.year}-${map.month}-${map.day}`; }

async function getCapabilities(tenantId: number, membershipId: number): Promise<AttendanceCapabilities> {
  const admin = createAdminClient(); const { data: roles, error: roleError } = await admin.from("membership_roles").select("role_id").eq("tenant_id", tenantId).eq("membership_id", membershipId); if (roleError) throw new Error(`Unable to resolve attendance roles: ${roleError.message}`); const roleIds = (roles ?? []).map((row) => row.role_id); if (!roleIds.length) return { canMark: false, canCorrect: false, canApprove: false,canViewStaff:false };
  const { data: permissions, error } = await admin.from("role_permissions").select("permission_code").eq("tenant_id", tenantId).in("role_id", roleIds).in("permission_code", ["attendance.student.mark", "attendance.student.correct", "attendance.student.approve","hr.employee.read"]); if (error) throw new Error(`Unable to resolve attendance permissions: ${error.message}`); const set = new Set((permissions ?? []).map((row) => row.permission_code)); return { canMark: set.has("attendance.student.mark"), canCorrect: set.has("attendance.student.correct"), canApprove: set.has("attendance.student.approve"),canViewStaff:set.has("hr.employee.read") };
}
async function resolveAttendanceTimezone(): Promise<string> { const workspace = await getTenantContext(); if (!workspace) return "UTC"; const admin = createAdminClient(); const { data } = await admin.from("institution_profiles").select("timezone").eq("tenant_id", workspace.tenantId).maybeSingle(); return typeof data?.timezone === "string" && data.timezone.trim() ? data.timezone : "UTC"; }
export const getAttendanceTimezone = cache(resolveAttendanceTimezone);
export async function getDefaultAttendanceDate(): Promise<string> { return dateInTimezone(await getAttendanceTimezone()); }

export async function getAttendanceWorkspace(args: { date: string; groupId?: number; search?: string; page?: number; pageSize?: number; locale: Locale }): Promise<AttendanceWorkspace> {
  const workspace = await getTenantContext(); if (!workspace || !workspace.branchId) throw new Error("Active branch is required."); const admin = createAdminClient();
  const [timezone, capabilities, rpc,emergencyRpc,insightsRpc] = await Promise.all([
    getAttendanceTimezone(), getCapabilities(workspace.tenantId, workspace.membershipId),
    admin.rpc("get_student_attendance_workspace_v3", { p_identity_id: workspace.identityId, p_tenant_id: workspace.tenantId, p_branch_id: workspace.branchId, p_attendance_date: args.date, p_group_id: args.groupId ?? null, p_search: args.search?.trim() || null, p_page: args.page ?? 1, p_page_size: args.pageSize ?? 50 }),
    admin.rpc("get_emergency_manual_attendance_v1",{p_identity_id:workspace.identityId,p_tenant_id:workspace.tenantId,p_branch_id:workspace.branchId,p_attendance_date:args.date,p_subject_type:"student"}),
    admin.rpc("get_attendance_v2_insights_v1",{p_identity_id:workspace.identityId,p_tenant_id:workspace.tenantId,p_branch_id:workspace.branchId,p_attendance_date:args.date})
  ]);
  if (rpc.error) throw new Error(`Unable to load attendance: ${rpc.error.message}`);if(emergencyRpc.error)throw new Error(`Unable to load emergency attendance state: ${emergencyRpc.error.message}`);if(insightsRpc.error)throw new Error(`Unable to load attendance insights: ${insightsRpc.error.message}`);
  const raw = rpc.data && typeof rpc.data === "object" && !Array.isArray(rpc.data) ? rpc.data as RawWorkspace : {}; const summary = raw.summary && typeof raw.summary === "object" && !Array.isArray(raw.summary) ? raw.summary as Record<string, unknown> : {};
  const emergencyRaw=objectValue(emergencyRpc.data),authorizations=mapEmergency(emergencyRaw.authorizations),active=authorizations.filter((a)=>a.active);const insightRaw=objectValue(insightsRpc.data);const scans=new Map<number,Raw>(arrayValue(insightRaw.scans).flatMap((r)=>{const personId=numberValue(r.person_id);return personId?[[personId,r] as [number,Raw]]:[]}));
  const rows=mapRows(raw.rows).map((row)=>{const scan=scans.get(row.personId);const authorized=active.some((a)=>a.scopeType==="branch"||(a.scopeType==="group"&&a.groupId===row.groupId)||(a.scopeType==="student"&&a.studentPersonId===row.personId));return{...row,firstScan:stringValue(scan?.first_scan),lastScan:stringValue(scan?.last_scan),deviceLabel:stringValue(scan?.device_label),modality:stringValue(scan?.modality),emergencyManualAuthorized:authorized};});
  return { date: stringValue(raw.attendance_date) ?? args.date, timezone, started: raw.started === true, sessionId: numberValue(raw.session_id), rosterId: numberValue(raw.roster_id), state: stringValue(raw.state) ?? "not_started", statuses: mapStatuses(raw.statuses), capabilities,
    summary: { total: Number(summary.total ?? 0), present: Number(summary.present ?? 0), absent: Number(summary.absent ?? 0), late: Number(summary.late ?? 0), leave: Number(summary.leave ?? 0), unmarked: Number(summary.unmarked ?? 0), biometric: Number(summary.biometric ?? 0), nfc: Number(summary.nfc ?? 0), pendingCorrections: Number(summary.pending_corrections ?? 0) },
    insights:{dailyPercent:numberValue(insightRaw.daily_percent)??0,weeklyPercent:numberValue(insightRaw.weekly_percent)??0,monthlyPercent:numberValue(insightRaw.monthly_percent)??0,trend:mapTrend(insightRaw.trend)},emergency:{canManage:boolValue(emergencyRaw.can_manage),authorizations},
    total: Number(raw.total ?? 0), page: Number(raw.page ?? args.page ?? 1), pageSize: Number(raw.page_size ?? args.pageSize ?? 50), rows };
}


export type AttendanceGroupOption = {
  id: number;
  key: string;
  label: string;
};

function localizedGroupLabel(labels: unknown, locale: Locale, fallback: string) {
  if (!labels || typeof labels !== "object" || Array.isArray(labels)) return fallback;
  const map = labels as Record<string, unknown>;
  const value = map[locale] ?? map.en;
  return typeof value === "string" && value.trim() ? value : fallback;
}

export async function getAttendancePageOptions(locale: Locale): Promise<{
  groups: AttendanceGroupOption[];
  canViewStaff: boolean;
}> {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) throw new Error("Active branch is required.");
  const admin = createAdminClient();
  const [capabilities, groupsResult] = await Promise.all([
    getCapabilities(workspace.tenantId, workspace.membershipId),
    admin
      .from("academic_groups")
      .select("id,key,labels")
      .eq("tenant_id", workspace.tenantId)
      .eq("branch_id", workspace.branchId)
      .eq("status", "active")
      .order("key", { ascending: true })
  ]);
  if (groupsResult.error) {
    throw new Error(`Unable to load attendance class/group options: ${groupsResult.error.message}`);
  }
  return {
    groups: (groupsResult.data ?? []).map((row) => ({
      id: row.id,
      key: row.key,
      label: localizedGroupLabel(row.labels, locale, row.key)
    })),
    canViewStaff: capabilities.canViewStaff
  };
}

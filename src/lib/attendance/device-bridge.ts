import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";

type Raw = Record<string, unknown>;
const object = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const rows = (value: unknown): Raw[] => Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Raw[] : [];
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value : null;
const number = (value: unknown): number | null => Number.isFinite(Number(value)) ? Number(value) : null;

export type AttendanceDevice = {
  id: number;
  externalDeviceKey: string;
  label: string;
  modality: "biometric";
  vendor: string | null;
  model: string | null;
  tokenHint: string;
  state: string;
  lastSeenAt: string | null;
};
export type AttendanceDeviceSubject = { id: number; deviceId: number; deviceLabel: string; externalSubjectKey: string; subjectType: "student" | "staff"; subjectNumber: string | null; subjectName: string | null; studentPersonId: number | null; employmentId: number | null; state: string };
export type AttendanceDeviceEvent = { id: number; deviceId: number; deviceLabel: string; externalEventId: string; externalSubjectKey: string; modality: "biometric"; eventType: "presence" | "check_in" | "check_out"; occurredAt: string; state: string; subjectType: "student" | "staff" | null; subjectNumber: string | null; subjectName: string | null; errorReason: string | null };
export type AttendanceDeviceCandidate = { id: number; number: string; name: string };
export type AttendanceDeviceCenter = { devices: AttendanceDevice[]; mappings: AttendanceDeviceSubject[]; events: AttendanceDeviceEvent[]; students: AttendanceDeviceCandidate[]; staff: AttendanceDeviceCandidate[]; localDate: string | null };

function requireWorkspace() {
  return getTenantContext().then((workspace) => {
    if (!workspace || !workspace.branchId) throw new Error("Active branch is required.");
    return workspace;
  });
}

export async function getAttendanceDeviceCenter(): Promise<AttendanceDeviceCenter> {
  const workspace = await requireWorkspace();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_attendance_device_center_v1", { p_identity_id: workspace.identityId, p_tenant_id: workspace.tenantId, p_branch_id: workspace.branchId });
  if (error) throw new Error(`Unable to load attendance device center: ${error.message}`);
  const raw = object(data);
  return {
    devices: rows(raw.devices).flatMap((row) => {
      const id = number(row.id), externalDeviceKey = text(row.external_device_key), label = text(row.label), modality = text(row.modality);
      if (!id || !externalDeviceKey || !label || modality !== "biometric") return [];
      return [{ id, externalDeviceKey, label, modality, vendor: text(row.vendor), model: text(row.model), tokenHint: text(row.token_hint) ?? "", state: text(row.state) ?? "active", lastSeenAt: text(row.last_seen_at) }];
    }),
    mappings: rows(raw.mappings).flatMap((row) => {
      const id = number(row.id), deviceId = number(row.device_id), deviceLabel = text(row.device_label), externalSubjectKey = text(row.external_subject_key), subjectType = text(row.subject_type);
      if (!id || !deviceId || !deviceLabel || !externalSubjectKey || (subjectType !== "student" && subjectType !== "staff")) return [];
      return [{ id, deviceId, deviceLabel, externalSubjectKey, subjectType, subjectNumber: text(row.subject_number), subjectName: text(row.subject_name), studentPersonId: number(row.student_person_id), employmentId: number(row.employment_id), state: text(row.state) ?? "active" }];
    }),
    events: rows(raw.events).flatMap((row) => {
      const id = number(row.id), deviceId = number(row.device_id), deviceLabel = text(row.device_label), externalEventId = text(row.external_event_id), externalSubjectKey = text(row.external_subject_key), modality = text(row.modality), eventType = text(row.event_type), occurredAt = text(row.occurred_at), subjectType = text(row.subject_type);
      if (!id || !deviceId || !deviceLabel || !externalEventId || !externalSubjectKey || !occurredAt || modality !== "biometric" || (eventType !== "presence" && eventType !== "check_in" && eventType !== "check_out")) return [];
      return [{ id, deviceId, deviceLabel, externalEventId, externalSubjectKey, modality, eventType, occurredAt, state: text(row.state) ?? "received", subjectType: subjectType === "student" || subjectType === "staff" ? subjectType : null, subjectNumber: text(row.subject_number), subjectName: text(row.subject_name), errorReason: text(row.error_reason) }];
    }),
    students: rows(raw.students).flatMap((row) => { const id = number(row.student_person_id), studentNumber = text(row.student_number), name = text(row.display_name); return id && studentNumber && name ? [{ id, number: studentNumber, name }] : []; }),
    staff: rows(raw.staff).flatMap((row) => { const id = number(row.employment_id), employeeNumber = text(row.employee_number), name = text(row.display_name); return id && employeeNumber && name ? [{ id, number: employeeNumber, name }] : []; }),
    localDate: text(raw.local_date)
  };
}

export async function createAttendanceDevice(input: { externalDeviceKey: string; label: string; modality: "biometric"; vendor?: string | null; model?: string | null }) {
  const workspace = await requireWorkspace(); const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_attendance_device_v1", { p_identity_id: workspace.identityId, p_tenant_id: workspace.tenantId, p_branch_id: workspace.branchId, p_external_device_key: input.externalDeviceKey, p_label: input.label, p_modality: input.modality, p_vendor: input.vendor ?? null, p_model: input.model ?? null });
  if (error) throw new Error(error.message); const raw = object(data); const deviceId = number(raw.device_id), ingestToken = text(raw.ingest_token); if (!deviceId || !ingestToken) throw new Error("Device runtime returned an invalid response.");
  return { deviceId, ingestToken, tokenHint: text(raw.token_hint) ?? ingestToken.slice(-8), externalDeviceKey: text(raw.external_device_key) ?? input.externalDeviceKey };
}

export async function rotateAttendanceDeviceToken(deviceId: number) {
  const workspace = await requireWorkspace(); const admin = createAdminClient();
  const { data, error } = await admin.rpc("rotate_attendance_device_token_v1", { p_identity_id: workspace.identityId, p_tenant_id: workspace.tenantId, p_branch_id: workspace.branchId, p_device_id: deviceId });
  if (error) throw new Error(error.message); const raw = object(data); const ingestToken = text(raw.ingest_token); if (!ingestToken) throw new Error("Device token rotation returned an invalid response."); return { deviceId: number(raw.device_id) ?? deviceId, ingestToken, tokenHint: text(raw.token_hint) ?? ingestToken.slice(-8) };
}

export async function mapAttendanceDeviceSubject(input: { deviceId: number; externalSubjectKey: string; subjectType: "student" | "staff"; subjectId: number }) {
  const workspace = await requireWorkspace(); const admin = createAdminClient();
  const { data, error } = await admin.rpc("map_attendance_device_subject_v1", { p_identity_id: workspace.identityId, p_tenant_id: workspace.tenantId, p_branch_id: workspace.branchId, p_device_id: input.deviceId, p_external_subject_key: input.externalSubjectKey, p_subject_type: input.subjectType, p_student_person_id: input.subjectType === "student" ? input.subjectId : null, p_employment_id: input.subjectType === "staff" ? input.subjectId : null });
  if (error) throw new Error(error.message); const raw = object(data); return { mappingId: number(raw.mapping_id) };
}

export async function applyAttendanceDeviceEvent(eventId: number) {
  const workspace = await requireWorkspace(); const admin = createAdminClient();
  const { data, error } = await admin.rpc("apply_attendance_device_event_v1", { p_identity_id: workspace.identityId, p_tenant_id: workspace.tenantId, p_branch_id: workspace.branchId, p_event_id: eventId });
  if (error) throw new Error(error.message); return object(data);
}

export async function receiveAttendanceDeviceEvent(input: { externalDeviceKey: string; ingestToken: string; externalEventId: string; externalSubjectKey: string; modality: "biometric"; eventType: "presence" | "check_in" | "check_out"; occurredAt: string; metadata?: Record<string, string | number | boolean | null> }) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("receive_attendance_device_event_v1", { p_external_device_key: input.externalDeviceKey, p_ingest_token: input.ingestToken, p_external_event_id: input.externalEventId, p_external_subject_key: input.externalSubjectKey, p_modality: input.modality, p_event_type: input.eventType, p_occurred_at: input.occurredAt, p_metadata: input.metadata ?? {} });
  if (error) throw new Error(error.message); return object(data);
}

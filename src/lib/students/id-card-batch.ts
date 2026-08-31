import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";
import { ID_CARD_BATCH_LIMIT, normalizeIdCardStudentIds } from "./id-card-batch-model";

export { ID_CARD_BATCH_LIMIT, normalizeIdCardStudentIds };

export type IdCardBatchStudent = {
  personId: number;
  studentNumber: string;
  name: string;
  nativeName: string | null;
  dateOfBirth: string | null;
  status: string;
  program: string;
  group: string;
  guardianName: string | null;
};

export type IdCardBatchResult = {
  sessions: Array<{ id: number; label: string }>;
  groups: Array<{ id: number; sessionId: number; programId: number; label: string }>;
  students: IdCardBatchStudent[];
  limit: number;
};

type LabelRow = { id: number; key: string; labels: unknown };
type GroupRow = LabelRow & { session_id: number; program_id: number };
type StudentRow = {
  person_id: number;
  student_number: string;
  name: string;
  native_name: string | null;
  date_of_birth: string | null;
  status: string;
  program_key: string | null;
  program_labels: unknown;
  group_key: string | null;
  group_labels: unknown;
  guardian_name: string | null;
};
type RuntimeResult = { sessions?: LabelRow[]; groups?: GroupRow[]; students?: StudentRow[]; limit?: number };

function localizedLabel(labels: unknown, locale: string, fallback: string): string {
  if (!labels || typeof labels !== "object" || Array.isArray(labels)) return fallback;
  const map = labels as Record<string, unknown>;
  const value = map[locale] ?? map.en;
  return typeof value === "string" && value.trim() ? value : fallback;
}

export async function getStudentIdCardBatch(options: {
  locale: string;
  sessionId?: number | null;
  groupId?: number | null;
  personIds?: number[] | null;
}): Promise<IdCardBatchResult> {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) throw new Error("Active branch is required for bulk ID cards.");
  if (options.personIds && options.personIds.length > ID_CARD_BATCH_LIMIT) throw new Error(`Select no more than ${ID_CARD_BATCH_LIMIT} students.`);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_student_id_card_batch", {
    p_identity_id: workspace.identityId,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_session_id: options.sessionId ?? null,
    p_group_id: options.groupId ?? null,
    p_person_ids: options.personIds?.length ? options.personIds : null
  });
  if (error) throw new Error(`Unable to load bulk ID cards: ${error.message}`);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Bulk ID card runtime returned an invalid response.");

  const result = data as RuntimeResult;
  const sessions = Array.isArray(result.sessions) ? result.sessions : [];
  const groups = Array.isArray(result.groups) ? result.groups : [];
  const students = Array.isArray(result.students) ? result.students : [];
  return {
    sessions: sessions.map((row) => ({ id: row.id, label: localizedLabel(row.labels, options.locale, row.key) })),
    groups: groups.map((row) => ({ id: row.id, sessionId: row.session_id, programId: row.program_id, label: localizedLabel(row.labels, options.locale, row.key) })),
    students: students.map((row) => ({
      personId: row.person_id,
      studentNumber: row.student_number,
      name: row.name,
      nativeName: row.native_name,
      dateOfBirth: row.date_of_birth,
      status: row.status,
      program: row.program_key ? localizedLabel(row.program_labels, options.locale, row.program_key) : "—",
      group: row.group_key ? localizedLabel(row.group_labels, options.locale, row.group_key) : "—",
      guardianName: row.guardian_name
    })),
    limit: Math.min(Number(result.limit ?? ID_CARD_BATCH_LIMIT), ID_CARD_BATCH_LIMIT)
  };
}

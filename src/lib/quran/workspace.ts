import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";

export type QuranHifzRow = {
  personId: number;
  name: string;
  nameNative: string | null;
  studentNumber: string;
  groupId: number | null;
  groupName: string | null;
  lastRecordedAt: string | null;
  lastWorkCategory: string | null;
  lastOutcome: string | null;
  lastOverallScore: number | null;
  lastJuzNumber: number | null;
  sabaqLabel: string | null;
  sabqiLabel: string | null;
  manzilLabel: string | null;
  revisionDue: number;
  passedJuz: number;
};

export type QuranHifzWorkspace = {
  localDate: string | null;
  summary: {
    students: number;
    recordedToday: number;
    attemptsToday: number;
    revisionDue: number;
    averageToday: number | null;
    repeatToday: number;
  };
  total: number;
  page: number;
  pageSize: number;
  canRecord: boolean;
  rows: QuranHifzRow[];
};

type Raw = Record<string, unknown>;

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function mapRows(value: unknown): QuranHifzRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Raw;
    const personId = numberValue(row.person_id);
    if (!personId) return [];
    return [{
      personId,
      name: stringValue(row.name) ?? "Student",
      nameNative: stringValue(row.name_native),
      studentNumber: stringValue(row.student_number) ?? "—",
      groupId: numberValue(row.group_id),
      groupName: stringValue(row.group_name),
      lastRecordedAt: stringValue(row.last_recorded_at),
      lastWorkCategory: stringValue(row.last_work_category),
      lastOutcome: stringValue(row.last_outcome),
      lastOverallScore: numberValue(row.last_overall_score),
      lastJuzNumber: numberValue(row.last_juz_number),
      sabaqLabel: stringValue(row.sabaq_label),
      sabqiLabel: stringValue(row.sabqi_label),
      manzilLabel: stringValue(row.manzil_label),
      revisionDue: numberValue(row.revision_due) ?? 0,
      passedJuz: numberValue(row.memorized_juz) ?? 0
    }];
  });
}

export async function getQuranHifzWorkspace(args: { search?: string; page?: number; pageSize?: number }): Promise<QuranHifzWorkspace> {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) throw new Error("Active branch is required.");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_quran_hifz_workspace_v3", {
    p_identity_id: workspace.identityId,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_search: args.search?.trim() || null,
    p_page: args.page ?? 1,
    p_page_size: args.pageSize ?? 40
  });
  if (error) throw new Error(`Unable to load Qur'an & Hifz workspace: ${error.message}`);
  const raw: Raw = data && typeof data === "object" && !Array.isArray(data) ? data as Raw : {};
  const summary: Raw = raw.summary && typeof raw.summary === "object" && !Array.isArray(raw.summary) ? raw.summary as Raw : {};
  return {
    localDate: stringValue(raw.local_date),
    summary: {
      students: numberValue(summary.students) ?? 0,
      recordedToday: numberValue(summary.recorded_today) ?? 0,
      attemptsToday: numberValue(summary.attempts_today) ?? 0,
      revisionDue: numberValue(summary.revision_due) ?? 0,
      averageToday: numberValue(summary.average_today),
      repeatToday: numberValue(summary.repeat_today) ?? 0
    },
    total: numberValue(raw.total) ?? 0,
    page: numberValue(raw.page) ?? 1,
    pageSize: numberValue(raw.page_size) ?? 40,
    canRecord: raw.can_record === true,
    rows: mapRows(raw.rows)
  };
}

import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";

export type QuranDailyTargetView = {
  id?: number;
  workCategory: string;
  mode: "juz" | "ayah" | "page";
  label: string;
  juzNumber?: number;
  startSurahNumber?: number;
  startAyahNumber?: number;
  endSurahNumber?: number;
  endAyahNumber?: number;
  pageStart?: number;
  pageEnd?: number;
};

export type QuranDailyRow = {
  personId: number;
  name: string;
  nameNative: string | null;
  studentNumber: string;
  sabaq: string | null;
  sabqi: string | null;
  manzil: string | null;
  qualityScore: number | null;
  dayStatus: string | null;
  mistakeCount: number;
  revisionDue: number;
  revisionDueOn: string | null;
  memorizedJuz: number;
  nextTarget: QuranDailyTargetView | null;
  repeatTarget: QuranDailyTargetView | null;
};

export type QuranDailyRegister = {
  localDate: string;
  selectedDate: string;
  selectedGroupId: number | null;
  groups: { id: number; key: string; label: string; students: number }[];
  rows: QuranDailyRow[];
  summary: {
    students: number;
    recorded: number;
    needsSupport: number;
    revisionDue: number;
    monthlyAttempts: number;
    monthlyAverage: number | null;
  };
  canRecord: boolean;
};

type Raw = Record<string, unknown>;

function objectValue(value: unknown): Raw | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapTarget(value: unknown): QuranDailyTargetView | null {
  const raw = objectValue(value);
  if (!raw) return null;
  const mode = stringValue(raw.mode);
  if (mode !== "juz" && mode !== "ayah" && mode !== "page") return null;

  const result: QuranDailyTargetView = {
    workCategory: stringValue(raw.work_category) ?? "sabaq",
    mode,
    label: stringValue(raw.label) ?? "—"
  };

  const id = numberValue(raw.id);
  if (id) result.id = id;
  const juz = numberValue(raw.juz_number);
  if (juz) result.juzNumber = juz;
  const startSurah = numberValue(raw.start_surah_number);
  if (startSurah) result.startSurahNumber = startSurah;
  const startAyah = numberValue(raw.start_ayah_number);
  if (startAyah) result.startAyahNumber = startAyah;
  const endSurah = numberValue(raw.end_surah_number);
  if (endSurah) result.endSurahNumber = endSurah;
  const endAyah = numberValue(raw.end_ayah_number);
  if (endAyah) result.endAyahNumber = endAyah;
  const pageStart = numberValue(raw.page_start);
  if (pageStart) result.pageStart = pageStart;
  const pageEnd = numberValue(raw.page_end);
  if (pageEnd) result.pageEnd = pageEnd;
  return result;
}

function mapRow(value: unknown): QuranDailyRow | null {
  const raw = objectValue(value);
  if (!raw) return null;
  const personId = numberValue(raw.person_id);
  if (!personId) return null;

  return {
    personId,
    name: stringValue(raw.name) ?? "Student",
    nameNative: stringValue(raw.name_native),
    studentNumber: stringValue(raw.student_number) ?? "—",
    sabaq: stringValue(raw.sabaq),
    sabqi: stringValue(raw.sabqi),
    manzil: stringValue(raw.manzil),
    qualityScore: numberValue(raw.quality_score),
    dayStatus: stringValue(raw.day_status),
    mistakeCount: numberValue(raw.mistake_count) ?? 0,
    revisionDue: numberValue(raw.revision_due) ?? 0,
    revisionDueOn: stringValue(raw.revision_due_on),
    memorizedJuz: numberValue(raw.memorized_juz) ?? 0,
    nextTarget: mapTarget(raw.next_target),
    repeatTarget: mapTarget(raw.repeat_target)
  };
}

export async function getQuranDailyRegister(args: {
  groupId?: number | null;
  date?: string | null;
}): Promise<QuranDailyRegister> {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) throw new Error("Active branch is required.");

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_quran_hifz_daily_register_v2", {
    p_identity_id: workspace.identityId,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_group_id: args.groupId ?? null,
    p_session_date: args.date ?? null
  });
  if (error) throw new Error(`Unable to load Qur'an daily register: ${error.message}`);

  const raw = objectValue(data) ?? {};
  const summary = objectValue(raw.summary) ?? {};
  const groups = Array.isArray(raw.groups)
    ? raw.groups.flatMap((item) => {
        const group = objectValue(item);
        const id = numberValue(group?.id);
        if (!group || !id) return [];
        return [{
          id,
          key: stringValue(group.key) ?? String(id),
          label: stringValue(group.label) ?? `Group ${id}`,
          students: numberValue(group.students) ?? 0
        }];
      })
    : [];
  const rows = Array.isArray(raw.rows)
    ? raw.rows.flatMap((item) => {
        const row = mapRow(item);
        return row ? [row] : [];
      })
    : [];

  return {
    localDate: stringValue(raw.local_date) ?? new Date().toISOString().slice(0, 10),
    selectedDate: stringValue(raw.selected_date) ?? stringValue(raw.local_date) ?? new Date().toISOString().slice(0, 10),
    selectedGroupId: numberValue(raw.selected_group_id),
    groups,
    rows,
    summary: {
      students: numberValue(summary.students) ?? 0,
      recorded: numberValue(summary.recorded) ?? 0,
      needsSupport: numberValue(summary.needs_support) ?? 0,
      revisionDue: numberValue(summary.revision_due) ?? 0,
      monthlyAttempts: numberValue(summary.monthly_attempts) ?? 0,
      monthlyAverage: numberValue(summary.monthly_average)
    },
    canRecord: raw.can_record === true
  };
}

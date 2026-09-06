import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenancy/context";

export type StudentRegisterRow = {
  personId: number;
  studentNumber: string;
  name: string;
  nativeName: string | null;
  status: string;
  joinedOn: string | null;
  program: string;
  group: string;
};

export type StudentRegisterResult = {
  rows: StudentRegisterRow[];
  total: number;
  active: number;
  page: number;
  pageSize: number;
  pages: number;
};

type RuntimeRow = {
  person_id: number;
  student_number: string;
  name: string;
  native_name: string | null;
  status: string;
  joined_on: string | null;
  program_key: string | null;
  program_labels: unknown;
  group_key: string | null;
  group_labels: unknown;
};

type RuntimeResult = {
  rows?: RuntimeRow[];
  total?: number;
  active?: number;
  page?: number;
  page_size?: number;
  pages?: number;
};

function localizedLabel(labels: unknown, locale: string, fallback: string): string {
  if (!labels || typeof labels !== "object" || Array.isArray(labels)) return fallback;
  const map = labels as Record<string, unknown>;
  const value = map[locale] ?? map.en;
  return typeof value === "string" && value.trim() ? value : fallback;
}

async function loadRegisterPage(options: {
  identityId: string;
  tenantId: number;
  branchId: number;
  locale: string;
  query?: string;
  status?: string;
  page: number;
  pageSize: number;
}): Promise<StudentRegisterResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_student_register_page", {
    p_identity_id: options.identityId,
    p_tenant_id: options.tenantId,
    p_branch_id: options.branchId,
    p_query: options.query?.trim() || null,
    p_status: options.status?.trim() || null,
    p_page: options.page,
    p_page_size: options.pageSize
  });
  if (error) throw new Error(`Unable to load student register: ${error.message}`);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Student register returned an invalid response.");
  const result = data as RuntimeResult;
  const rows = Array.isArray(result.rows) ? result.rows : [];
  return {
    rows: rows.map((row) => ({
      personId: row.person_id,
      studentNumber: row.student_number,
      name: row.name,
      nativeName: row.native_name,
      status: row.status,
      joinedOn: row.joined_on,
      program: row.program_key ? localizedLabel(row.program_labels, options.locale, row.program_key) : "—",
      group: row.group_key ? localizedLabel(row.group_labels, options.locale, row.group_key) : "—"
    })),
    total: Number(result.total ?? 0),
    active: Number(result.active ?? 0),
    page: Math.max(Number(result.page ?? options.page), 1),
    pageSize: Math.max(Number(result.page_size ?? options.pageSize), 1),
    pages: Math.max(Number(result.pages ?? 1), 1)
  };
}

export async function getStudentRegister(options: {
  locale: string;
  query?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<StudentRegisterResult> {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) throw new Error("Active branch is required for student records.");
  const pageSize = Math.min(Math.max(options.pageSize ?? 25, 1), 500);
  const requestedPage = Math.max(options.page ?? 1, 1);
  const first = await loadRegisterPage({
    identityId: workspace.identityId,
    tenantId: workspace.tenantId,
    branchId: workspace.branchId,
    locale: options.locale,
    query: options.query,
    status: options.status,
    page: requestedPage,
    pageSize
  });
  if (requestedPage <= first.pages) return first;
  return loadRegisterPage({
    identityId: workspace.identityId,
    tenantId: workspace.tenantId,
    branchId: workspace.branchId,
    locale: options.locale,
    query: options.query,
    status: options.status,
    page: first.pages,
    pageSize
  });
}

export type StudentCreateOptions = {
  sessions: Array<{ id: number; label: string }>;
  programs: Array<{ id: number; label: string }>;
  groups: Array<{ id: number; key: string; label: string; sessionId: number; programId: number }>;
};

export async function getStudentCreateOptions(locale: string): Promise<StudentCreateOptions> {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) throw new Error("Active branch is required.");
  const supabase = await createClient();

  const [sessions, programs, groups] = await Promise.all([
    supabase.from("academic_sessions").select("id,key,labels").eq("tenant_id", workspace.tenantId).eq("status", "active").order("starts_on", { ascending: false }),
    supabase.from("programs").select("id,key,labels,branch_id").eq("tenant_id", workspace.tenantId).eq("status", "active"),
    supabase.from("academic_groups").select("id,key,labels,session_id,program_id").eq("tenant_id", workspace.tenantId).eq("branch_id", workspace.branchId).eq("status", "active")
  ]);

  if (sessions.error) throw new Error(`Unable to load academic sessions: ${sessions.error.message}`);
  if (programs.error) throw new Error(`Unable to load programs: ${programs.error.message}`);
  if (groups.error) throw new Error(`Unable to load classes: ${groups.error.message}`);

  return {
    sessions: (sessions.data ?? []).map((row) => ({ id: row.id, label: localizedLabel(row.labels, locale, row.key) })),
    programs: (programs.data ?? [])
      .filter((row) => row.branch_id === null || row.branch_id === workspace.branchId)
      .map((row) => ({ id: row.id, label: localizedLabel(row.labels, locale, row.key) })),
    groups: (groups.data ?? []).map((row) => ({
      id: row.id,
      key: row.key,
      label: localizedLabel(row.labels, locale, row.key),
      sessionId: row.session_id,
      programId: row.program_id
    }))
  };
}

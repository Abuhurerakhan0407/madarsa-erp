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

function localizedLabel(labels: unknown, locale: string, fallback: string): string {
  if (!labels || typeof labels !== "object" || Array.isArray(labels)) return fallback;
  const map = labels as Record<string, unknown>;
  const value = map[locale] ?? map.en;
  return typeof value === "string" && value.trim() ? value : fallback;
}

export async function getStudentRegister(options: {
  locale: string;
  query?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<StudentRegisterResult> {
  const workspace = await getTenantContext();
  if (!workspace) throw new Error("Tenant context is required for student records.");

  const supabase = await createClient();
  const pageSize = Math.min(Math.max(options.pageSize ?? 25, 10), 100);
  const requestedPage = Math.max(options.page ?? 1, 1);
  const query = options.query?.trim();
  const status = options.status?.trim();

  let personIds: number[] | null = null;
  if (query) {
    const escaped = query.replace(/[%_,()]/g, "").slice(0, 100);
    const [personMatches, numberMatches] = await Promise.all([
      supabase
        .from("persons")
        .select("id")
        .eq("tenant_id", workspace.tenantId)
        .or(`display_name.ilike.%${escaped}%,name_native.ilike.%${escaped}%`)
        .limit(500),
      supabase
        .from("student_profiles")
        .select("person_id")
        .eq("tenant_id", workspace.tenantId)
        .ilike("student_number", `%${escaped}%`)
        .limit(500)
    ]);
    if (personMatches.error) throw new Error(`Unable to search students: ${personMatches.error.message}`);
    if (numberMatches.error) throw new Error(`Unable to search student numbers: ${numberMatches.error.message}`);
    personIds = [...new Set([
      ...(personMatches.data ?? []).map((row) => row.id),
      ...(numberMatches.data ?? []).map((row) => row.person_id)
    ])];
    if (personIds.length === 0) {
      return { rows: [], total: 0, active: 0, page: 1, pageSize, pages: 1 };
    }
  }

  let countQuery = supabase
    .from("student_profiles")
    .select("person_id", { count: "exact", head: true })
    .eq("tenant_id", workspace.tenantId);
  if (status && status !== "all") countQuery = countQuery.eq("status", status);
  if (personIds) countQuery = countQuery.in("person_id", personIds);

  const { count, error: countError } = await countQuery;
  if (countError) throw new Error(`Unable to count students: ${countError.message}`);
  const total = count ?? 0;
  const pages = Math.max(Math.ceil(total / pageSize), 1);
  const page = Math.min(requestedPage, pages);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let profileQuery = supabase
    .from("student_profiles")
    .select("person_id,student_number,status,joined_on")
    .eq("tenant_id", workspace.tenantId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status && status !== "all") profileQuery = profileQuery.eq("status", status);
  if (personIds) profileQuery = profileQuery.in("person_id", personIds);

  const [{ data: profiles, error: profileError }, { count: activeCount, error: activeError }] = await Promise.all([
    profileQuery,
    supabase
      .from("student_profiles")
      .select("person_id", { count: "exact", head: true })
      .eq("tenant_id", workspace.tenantId)
      .eq("status", "active")
  ]);
  if (profileError) throw new Error(`Unable to load students: ${profileError.message}`);
  if (activeError) throw new Error(`Unable to count active students: ${activeError.message}`);

  const ids = (profiles ?? []).map((row) => row.person_id);
  if (ids.length === 0) {
    return { rows: [], total, active: activeCount ?? 0, page, pageSize, pages };
  }

  const [peopleResult, enrollmentResult] = await Promise.all([
    supabase
      .from("persons")
      .select("id,display_name,name_native")
      .eq("tenant_id", workspace.tenantId)
      .in("id", ids),
    supabase
      .from("enrollments")
      .select("student_person_id,program_id,group_id")
      .eq("tenant_id", workspace.tenantId)
      .eq("status", "active")
      .in("student_person_id", ids)
  ]);
  if (peopleResult.error) throw new Error(`Unable to load student names: ${peopleResult.error.message}`);
  if (enrollmentResult.error) throw new Error(`Unable to load student enrollments: ${enrollmentResult.error.message}`);

  const programIds = [...new Set((enrollmentResult.data ?? []).map((row) => row.program_id))];
  const groupIds = [...new Set((enrollmentResult.data ?? []).map((row) => row.group_id).filter((id): id is number => id !== null))];
  const [programResult, groupResult] = await Promise.all([
    programIds.length
      ? supabase.from("programs").select("id,key,labels").eq("tenant_id", workspace.tenantId).in("id", programIds)
      : Promise.resolve({ data: [], error: null }),
    groupIds.length
      ? supabase.from("academic_groups").select("id,key,labels").eq("tenant_id", workspace.tenantId).in("id", groupIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (programResult.error) throw new Error(`Unable to load programs: ${programResult.error.message}`);
  if (groupResult.error) throw new Error(`Unable to load classes: ${groupResult.error.message}`);

  const people = new Map((peopleResult.data ?? []).map((row) => [row.id, row]));
  const enrollments = new Map((enrollmentResult.data ?? []).map((row) => [row.student_person_id, row]));
  const programs = new Map((programResult.data ?? []).map((row) => [row.id, localizedLabel(row.labels, options.locale, row.key)]));
  const groups = new Map((groupResult.data ?? []).map((row) => [row.id, localizedLabel(row.labels, options.locale, row.key)]));

  return {
    rows: (profiles ?? []).map((profile) => {
      const person = people.get(profile.person_id);
      const enrollment = enrollments.get(profile.person_id);
      return {
        personId: profile.person_id,
        studentNumber: profile.student_number,
        name: person?.display_name ?? `Student ${profile.person_id}`,
        nativeName: person?.name_native ?? null,
        status: profile.status,
        joinedOn: profile.joined_on,
        program: enrollment ? programs.get(enrollment.program_id) ?? "—" : "—",
        group: enrollment?.group_id ? groups.get(enrollment.group_id) ?? "—" : "—"
      };
    }),
    total,
    active: activeCount ?? 0,
    page,
    pageSize,
    pages
  };
}

export type StudentCreateOptions = {
  sessions: Array<{ id: number; label: string }>;
  programs: Array<{ id: number; label: string }>;
  groups: Array<{ id: number; label: string; sessionId: number; programId: number }>;
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
      label: localizedLabel(row.labels, locale, row.key),
      sessionId: row.session_id,
      programId: row.program_id
    }))
  };
}

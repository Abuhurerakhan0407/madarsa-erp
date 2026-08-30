import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenancy/context";

export type StudentPlacement = {
  enrollmentId: number;
  session: string;
  program: string;
  currentGroupId: number | null;
  currentGroup: string;
  groups: Array<{ id: number; label: string }>;
};

function label(labels: unknown, locale: string, fallback: string): string {
  if (!labels || typeof labels !== "object" || Array.isArray(labels)) return fallback;
  const map = labels as Record<string, unknown>;
  const value = map[locale] ?? map.en;
  return typeof value === "string" && value.trim() ? value : fallback;
}

export async function getStudentPlacement(personId: number, locale: string): Promise<StudentPlacement | null> {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) throw new Error("Active branch is required.");
  const supabase = await createClient();
  const enrollment = await supabase.from("enrollments").select("id,session_id,program_id,group_id").eq("tenant_id", workspace.tenantId).eq("branch_id", workspace.branchId).eq("student_person_id", personId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (enrollment.error) throw new Error(`Unable to load active enrollment: ${enrollment.error.message}`);
  if (!enrollment.data) return null;

  const [session, program, groups] = await Promise.all([
    supabase.from("academic_sessions").select("key,labels").eq("tenant_id", workspace.tenantId).eq("id", enrollment.data.session_id).maybeSingle(),
    supabase.from("programs").select("key,labels").eq("tenant_id", workspace.tenantId).eq("id", enrollment.data.program_id).maybeSingle(),
    supabase.from("academic_groups").select("id,key,labels").eq("tenant_id", workspace.tenantId).eq("branch_id", workspace.branchId).eq("session_id", enrollment.data.session_id).eq("program_id", enrollment.data.program_id).eq("status", "active").order("key")
  ]);
  if (session.error) throw new Error(`Unable to load academic session: ${session.error.message}`);
  if (program.error) throw new Error(`Unable to load program: ${program.error.message}`);
  if (groups.error) throw new Error(`Unable to load classes: ${groups.error.message}`);

  const groupRows = groups.data ?? [];
  const current = enrollment.data.group_id ? groupRows.find((row) => row.id === enrollment.data?.group_id) : undefined;
  return {
    enrollmentId: enrollment.data.id,
    session: session.data ? label(session.data.labels, locale, session.data.key) : "—",
    program: program.data ? label(program.data.labels, locale, program.data.key) : "—",
    currentGroupId: enrollment.data.group_id,
    currentGroup: current ? label(current.labels, locale, current.key) : "—",
    groups: groupRows.map((row) => ({ id: row.id, label: label(row.labels, locale, row.key) }))
  };
}

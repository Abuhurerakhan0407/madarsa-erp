import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenancy/context";
import {
  buildProgramSummary,
  type AcademicEnrollmentRow,
  type AcademicGroupRow,
  type AcademicProgramRow,
  type ProgramSummaryRow
} from "./live-summary-helpers";

export type AcademicFoundationSummary = {
  sessions: number;
  programs: number;
  levels: number;
  groups: number;
  activeEnrollments: number;
  uniqueStudents: number;
  programRows: ProgramSummaryRow[];
};

export async function getAcademicFoundationSummary(
  locale: string
): Promise<AcademicFoundationSummary> {
  const workspace = await getTenantContext();
  if (!workspace) {
    throw new Error("Tenant context is required for academic data.");
  }

  const supabase = await createClient();
  const [sessions, programs, levels, groups, enrollments] = await Promise.all([
    supabase
      .from("academic_sessions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", workspace.tenantId)
      .eq("status", "active"),
    supabase
      .from("programs")
      .select("id,key,labels")
      .eq("tenant_id", workspace.tenantId)
      .eq("status", "active"),
    supabase
      .from("academic_levels")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", workspace.tenantId)
      .eq("status", "active"),
    supabase
      .from("academic_groups")
      .select("program_id")
      .eq("tenant_id", workspace.tenantId)
      .eq("status", "active"),
    supabase
      .from("enrollments")
      .select("program_id,student_person_id")
      .eq("tenant_id", workspace.tenantId)
      .eq("status", "active")
  ]);

  const failures = [
    ["sessions", sessions.error],
    ["programs", programs.error],
    ["levels", levels.error],
    ["groups", groups.error],
    ["enrollments", enrollments.error]
  ] as const;

  for (const [label, error] of failures) {
    if (error) {
      throw new Error(`Unable to load academic ${label}: ${error.message}`);
    }
  }

  const programRows = buildProgramSummary(
    (programs.data ?? []) as AcademicProgramRow[],
    (groups.data ?? []) as AcademicGroupRow[],
    (enrollments.data ?? []) as AcademicEnrollmentRow[],
    locale
  );
  const uniqueStudents = new Set(
    (enrollments.data ?? []).map((enrollment) => enrollment.student_person_id)
  ).size;

  return {
    sessions: sessions.count ?? 0,
    programs: programRows.length,
    levels: levels.count ?? 0,
    groups: groups.data?.length ?? 0,
    activeEnrollments: enrollments.data?.length ?? 0,
    uniqueStudents,
    programRows
  };
}

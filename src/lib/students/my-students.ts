import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNavigationAudience } from "@/lib/navigation/audience";
import { getTenantContext } from "@/lib/tenancy/context";

export type MyStudentRow = {
  personId: number;
  studentNumber: string;
  name: string;
  nativeName: string | null;
  group: string;
};

function label(value: unknown, locale: string, fallback: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const record = value as Record<string, unknown>;
  const localized = record[locale] ?? record.en;
  return typeof localized === "string" && localized.trim() ? localized : fallback;
}

function ids(rows: Array<{ group_id?: unknown }> | null | undefined) {
  return (rows ?? []).map((row) => Number(row.group_id)).filter(Number.isFinite);
}
export async function getMyStudents(locale: string): Promise<MyStudentRow[]> {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) notFound();
  if (await getNavigationAudience(workspace) !== "teacher") notFound();

  const admin = createAdminClient();
  const link = await admin.from("identity_person_links").select("person_id")
    .eq("tenant_id", workspace.tenantId).eq("identity_id", workspace.identityId)
    .eq("link_type", "employee").eq("status", "verified").limit(1).maybeSingle();
  if (link.error) throw new Error(`Unable to resolve teacher identity: ${link.error.message}`);
  if (!link.data) return [];

  const teacherPersonId = Number(link.data.person_id);
  const [primary, curriculum, timetable] = await Promise.all([
    admin.from("academic_groups").select("id").eq("tenant_id", workspace.tenantId)
      .eq("branch_id", workspace.branchId).eq("status", "active")
      .eq("primary_teacher_person_id", teacherPersonId),
    admin.from("curriculum_teaching_assignments").select("group_id")
      .eq("tenant_id", workspace.tenantId).eq("teacher_person_id", teacherPersonId)
      .eq("status", "active").not("group_id", "is", null),
    admin.from("timetable_entries").select("group_id").eq("tenant_id", workspace.tenantId)
      .eq("branch_id", workspace.branchId).eq("teacher_person_id", teacherPersonId)
      .eq("status", "active")
  ]);
  if (primary.error || curriculum.error || timetable.error) {
    throw new Error("Unable to load teaching scope.");
  }

  const groupIds = [...new Set([
    ...(primary.data ?? []).map((row) => Number(row.id)).filter(Number.isFinite),
    ...ids(curriculum.data),
    ...ids(timetable.data)
  ])];
  if (!groupIds.length) return [];

  const enrollments = await admin.from("enrollments").select("student_person_id,group_id")
    .eq("tenant_id", workspace.tenantId).eq("branch_id", workspace.branchId)
    .eq("status", "active").in("group_id", groupIds);
  if (enrollments.error) throw new Error(`Unable to load assigned students: ${enrollments.error.message}`);
  const personIds = [...new Set((enrollments.data ?? []).map((row) => Number(row.student_person_id)).filter(Number.isFinite))];
  if (!personIds.length) return [];

  const [people, profiles, groups] = await Promise.all([
    admin.from("persons").select("id,display_name,name_native").eq("tenant_id", workspace.tenantId).in("id", personIds),
    admin.from("student_profiles").select("person_id,student_number").eq("tenant_id", workspace.tenantId).in("person_id", personIds),
    admin.from("academic_groups").select("id,key,labels").eq("tenant_id", workspace.tenantId).eq("branch_id", workspace.branchId).in("id", groupIds)
  ]);
  if (people.error || profiles.error || groups.error) throw new Error("Unable to load assigned student details.");
  const profileMap = new Map((profiles.data ?? []).map((row) => [Number(row.person_id), String(row.student_number)]));
  const groupMap = new Map((groups.data ?? []).map((row) => [Number(row.id), label(row.labels, locale, String(row.key))]));
  const enrollmentMap = new Map((enrollments.data ?? []).map((row) => [Number(row.student_person_id), Number(row.group_id)]));

  return (people.data ?? []).map((row) => ({
    personId: Number(row.id),
    studentNumber: profileMap.get(Number(row.id)) ?? "—",
    name: String(row.display_name),
    nativeName: row.name_native ? String(row.name_native) : null,
    group: groupMap.get(enrollmentMap.get(Number(row.id)) ?? 0) ?? "—"
  })).sort((a, b) => a.name.localeCompare(b.name));
}

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNavigationAudience } from "@/lib/navigation/audience";
import { getTenantContext } from "@/lib/tenancy/context";
import { getTeacherAssignedEnrollments, getVerifiedTeacherPersonId } from "@/lib/students/teacher-scope";

export type MyStudentRow = { personId: number; studentNumber: string; name: string; nativeName: string | null; group: string };

function label(value: unknown, locale: string, fallback: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const record = value as Record<string, unknown>;
  const localized = record[locale] ?? record.en;
  return typeof localized === "string" && localized.trim() ? localized : fallback;
}

export async function getMyStudents(locale: string): Promise<MyStudentRow[]> {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) notFound();
  if (await getNavigationAudience(workspace) !== "teacher") notFound();

  const admin = createAdminClient();
  const teacherPersonId = await getVerifiedTeacherPersonId(workspace, admin);
  if (!teacherPersonId) return [];
  const enrollments = await getTeacherAssignedEnrollments(workspace, teacherPersonId, admin);
  const personIds = [...new Set(enrollments.map((row) => Number(row.student_person_id)).filter(Number.isFinite))];
  if (!personIds.length) return [];
  const groupIds = [...new Set(enrollments.map((row) => Number(row.group_id)).filter((id) => Number.isFinite(id) && id > 0))];
  const [people, profiles, groups] = await Promise.all([
    admin.from("persons").select("id,display_name,name_native").eq("tenant_id", workspace.tenantId).in("id", personIds),
    admin.from("student_profiles").select("person_id,student_number").eq("tenant_id", workspace.tenantId).in("person_id", personIds),
    groupIds.length
      ? admin.from("academic_groups").select("id,key,labels").eq("tenant_id", workspace.tenantId).eq("branch_id", workspace.branchId).in("id", groupIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (people.error || profiles.error || groups.error) throw new Error("Unable to load assigned student details.");

  const profileMap = new Map((profiles.data ?? []).map((row) => [Number(row.person_id), String(row.student_number)]));
  const groupMap = new Map((groups.data ?? []).map((row) => [Number(row.id), label(row.labels, locale, String(row.key))]));
  const enrollmentMap = new Map(enrollments.map((row) => [Number(row.student_person_id), Number(row.group_id)]));

  return (people.data ?? []).map((row) => ({
    personId: Number(row.id),
    studentNumber: profileMap.get(Number(row.id)) ?? "—",
    name: String(row.display_name),
    nativeName: row.name_native ? String(row.name_native) : null,
    group: groupMap.get(enrollmentMap.get(Number(row.id)) ?? 0) ?? "—"
  })).sort((a, b) => a.name.localeCompare(b.name));
}

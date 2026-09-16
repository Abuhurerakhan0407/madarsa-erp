import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMobileBearerToken } from "@/lib/mobile/server-auth";

const NATIVE_ORIGINS = new Set(["https://localhost", "capacitor://localhost"]);
type Raw = Record<string, unknown>;

const object = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const text = (value: unknown) => typeof value === "string" && value.trim() ? value : null;
const localizedLabel = (labels: unknown, fallback: string) => {
  const map = object(labels);
  return text(map.en) ?? text(map.ur) ?? text(map.ar) ?? fallback;
};

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (!origin || !NATIVE_ORIGINS.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(request: NextRequest, body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  const cors = corsHeaders(request);
  if (cors) for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}

export function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (!NATIVE_ORIGINS.has(origin)) return new NextResponse(null, { status: 403, headers: { Vary: "Origin" } });
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) ?? undefined });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !NATIVE_ORIGINS.has(origin) && origin !== request.nextUrl.origin) {
    return json(request, { error: "origin_not_allowed" }, { status: 403 });
  }

  const tenantId = Number.parseInt(request.nextUrl.searchParams.get("tenantId") ?? "", 10);
  const branchId = Number.parseInt(request.nextUrl.searchParams.get("branchId") ?? "", 10);
  if (!Number.isInteger(tenantId) || tenantId <= 0 || !Number.isInteger(branchId) || branchId <= 0) {
    return json(request, { error: "invalid_request" }, { status: 400 });
  }

  const token = getMobileBearerToken(request);
  if (!token) return json(request, { error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) return json(request, { error: "unauthorized" }, { status: 401 });

  const { data: links, error: linkError } = await admin
    .from("identity_person_links")
    .select("person_id")
    .eq("tenant_id", tenantId)
    .eq("identity_id", user.id)
    .eq("link_type", "employee")
    .eq("status", "verified");
  if (linkError || !links?.length) return json(request, { error: "teacher_scope_denied" }, { status: 403 });

  const teacherPersonIds = [...new Set(links.map((link) => Number(link.person_id)).filter((id) => Number.isInteger(id) && id > 0))];
  const { data: employments, error: employmentError } = await admin
    .from("hr_employments")
    .select("employee_person_id")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .in("employee_person_id", teacherPersonIds)
    .in("state", ["active", "on_leave"]);
  if (employmentError || !employments?.length) return json(request, { error: "teacher_scope_denied" }, { status: 403 });

  const activeTeacherIds = [...new Set(employments.map((row) => Number(row.employee_person_id)).filter((id) => id > 0))];
  const [primaryGroups, curriculumAssignments, timetableAssignments] = await Promise.all([
    admin
      .from("academic_groups")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("status", "active")
      .in("primary_teacher_person_id", activeTeacherIds),
    admin
      .from("curriculum_teaching_assignments")
      .select("group_id")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .in("teacher_person_id", activeTeacherIds)
      .not("group_id", "is", null),
    admin
      .from("timetable_entries")
      .select("group_id")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("status", "active")
      .in("teacher_person_id", activeTeacherIds),
  ]);

  if (primaryGroups.error || curriculumAssignments.error || timetableAssignments.error) {
    console.error("mobile teacher group scope failed", {
      primary: primaryGroups.error?.code,
      curriculum: curriculumAssignments.error?.code,
      timetable: timetableAssignments.error?.code,
    });
    return json(request, { error: "classes_unavailable" }, { status: 503 });
  }

  const groupIds = [...new Set([
    ...(primaryGroups.data ?? []).map((row) => Number(row.id)),
    ...(curriculumAssignments.data ?? []).map((row) => Number(row.group_id)),
    ...(timetableAssignments.data ?? []).map((row) => Number(row.group_id)),
  ].filter((id) => Number.isInteger(id) && id > 0))];

  if (!groupIds.length) return json(request, { readOnly: true, groups: [], students: [] });

  const [groupsResult, enrollmentsResult] = await Promise.all([
    admin
      .from("academic_groups")
      .select("id,key,labels,program_id,session_id,status")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("status", "active")
      .in("id", groupIds)
      .order("id", { ascending: true }),
    admin
      .from("enrollments")
      .select("student_person_id,group_id,status")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .in("group_id", groupIds)
      .in("status", ["active", "paused"]),
  ]);

  if (groupsResult.error || enrollmentsResult.error) {
    console.error("mobile teacher classes load failed", { groups: groupsResult.error?.code, enrollments: enrollmentsResult.error?.code });
    return json(request, { error: "classes_unavailable" }, { status: 503 });
  }

  const studentPersonIds = [...new Set((enrollmentsResult.data ?? []).map((row) => Number(row.student_person_id)).filter((id) => id > 0))];
  let persons: Array<{ id: number; display_name: string; name_native: string | null }> = [];
  let profiles: Array<{ person_id: number; student_number: string; status: string }> = [];

  if (studentPersonIds.length) {
    const [personsResult, profilesResult] = await Promise.all([
      admin.from("persons").select("id,display_name,name_native").eq("tenant_id", tenantId).in("id", studentPersonIds),
      admin.from("student_profiles").select("person_id,student_number,status").eq("tenant_id", tenantId).in("person_id", studentPersonIds),
    ]);
    if (personsResult.error || profilesResult.error) {
      console.error("mobile teacher student identity load failed", { persons: personsResult.error?.code, profiles: profilesResult.error?.code });
      return json(request, { error: "classes_unavailable" }, { status: 503 });
    }
    persons = personsResult.data ?? [];
    profiles = profilesResult.data ?? [];
  }

  const personMap = new Map(persons.map((row) => [Number(row.id), row]));
  const profileMap = new Map(profiles.map((row) => [Number(row.person_id), row]));
  const groupMap = new Map((groupsResult.data ?? []).map((row) => [Number(row.id), row]));

  const students = (enrollmentsResult.data ?? []).flatMap((enrollment) => {
    const personId = Number(enrollment.student_person_id);
    const groupId = Number(enrollment.group_id);
    const person = personMap.get(personId);
    const profile = profileMap.get(personId);
    const group = groupMap.get(groupId);
    if (!person || !profile || !group) return [];
    return [{
      personId,
      groupId,
      groupName: localizedLabel(group.labels, group.key ?? `Group ${groupId}`),
      studentNumber: profile.student_number,
      name: person.display_name,
      nativeName: person.name_native,
      status: profile.status,
      enrollmentStatus: enrollment.status,
    }];
  });

  const groups = (groupsResult.data ?? []).map((group) => ({
    id: Number(group.id),
    name: localizedLabel(group.labels, group.key ?? `Group ${group.id}`),
    studentCount: students.filter((student) => student.groupId === Number(group.id)).length,
  }));

  return json(request, { readOnly: true, groups, students });
}

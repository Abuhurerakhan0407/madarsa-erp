import { createAdminClient } from "@/lib/supabase/admin";

export type TeacherScopeWorkspace = {
  tenantId: number;
  branchId: number | null;
  identityId: string;
};

export type TeacherAssignmentScope = {
  groupIds: number[];
  studentPersonIds: number[];
  studentAssignments: Array<{ studentPersonId: number; sessionId: number; programId: number }>;
};

export type TeacherAssignedEnrollment = {
  id: number;
  student_person_id: number;
  session_id: number | null;
  program_id: number | null;
  group_id: number | null;
  status: string;
};

type CurriculumAssignmentRow = {
  session_id: number;
  program_id: number;
  group_id: number | null;
  student_person_id: number | null;
};

type AdminClient = ReturnType<typeof createAdminClient>;

function finiteIds(values: unknown[]): number[] {
  return [...new Set(values.map(Number).filter((value) => Number.isSafeInteger(value) && value > 0))];
}

export async function getVerifiedTeacherPersonId(
  workspace: TeacherScopeWorkspace,
  admin: AdminClient = createAdminClient()
): Promise<number | null> {
  const link = await admin.from("identity_person_links").select("person_id")
    .eq("tenant_id", workspace.tenantId)
    .eq("identity_id", workspace.identityId)
    .eq("link_type", "employee")
    .eq("status", "verified")
    .limit(1)
    .maybeSingle();
  if (link.error) throw new Error(`Unable to resolve teacher identity: ${link.error.message}`);
  const personId = Number(link.data?.person_id);
  return Number.isSafeInteger(personId) && personId > 0 ? personId : null;
}

export async function getTeacherAssignmentScope(
  workspace: TeacherScopeWorkspace,
  teacherPersonId: number,
  admin: AdminClient = createAdminClient()
): Promise<TeacherAssignmentScope> {
  if (!workspace.branchId) return { groupIds: [], studentPersonIds: [], studentAssignments: [] };
  const [primary, curriculum, timetable] = await Promise.all([
    admin.from("academic_groups").select("id,session_id,program_id")
      .eq("tenant_id", workspace.tenantId)
      .eq("branch_id", workspace.branchId)
      .eq("primary_teacher_person_id", teacherPersonId)
      .eq("status", "active"),
    admin.from("curriculum_teaching_assignments")
      .select("session_id,program_id,group_id,student_person_id")
      .eq("tenant_id", workspace.tenantId)
      .eq("teacher_person_id", teacherPersonId)
      .eq("status", "active"),
    admin.from("timetable_entries").select("group_id")
      .eq("tenant_id", workspace.tenantId)
      .eq("branch_id", workspace.branchId)
      .eq("teacher_person_id", teacherPersonId)
      .eq("status", "active")
  ]);

  if (primary.error || curriculum.error || timetable.error) {
    throw new Error("Unable to load teaching scope.");
  }

  const curriculumRows = (curriculum.data ?? []) as CurriculumAssignmentRow[];
  const curriculumGroupIds = finiteIds(curriculumRows.map((row) => row.group_id));
  const curriculumGroups = curriculumGroupIds.length
    ? await admin.from("academic_groups").select("id,session_id,program_id")
      .eq("tenant_id", workspace.tenantId)
      .eq("branch_id", workspace.branchId)
      .eq("status", "active")
      .in("id", curriculumGroupIds)
    : { data: [], error: null };
  if (curriculumGroups.error) {
    throw new Error(`Unable to verify curriculum teaching groups: ${curriculumGroups.error.message}`);
  }

  const validCurriculumGroupIds = finiteIds((curriculumGroups.data ?? []).flatMap((group) => {
    const id = Number(group.id);
    const matches = curriculumRows.some((row) => Number(row.group_id) === id
      && Number(row.session_id) === Number(group.session_id)
      && Number(row.program_id) === Number(group.program_id));
    return matches ? [id] : [];
  }));

  const directAssignments = curriculumRows.filter((row) => {
    const studentPersonId = Number(row.student_person_id);
    return Number.isSafeInteger(studentPersonId) && studentPersonId > 0;
  });
  const directStudentIds = finiteIds(directAssignments.map((row) => row.student_person_id));
  const directEnrollments = directStudentIds.length
    ? await admin.from("enrollments").select("student_person_id,session_id,program_id")
      .eq("tenant_id", workspace.tenantId)
      .eq("branch_id", workspace.branchId)
      .eq("status", "active")
      .in("student_person_id", directStudentIds)
    : { data: [], error: null };
  if (directEnrollments.error) {
    throw new Error(`Unable to verify curriculum student assignments: ${directEnrollments.error.message}`);
  }

  const validDirectAssignments = (directEnrollments.data ?? []).flatMap((enrollment) => {
    const studentPersonId = Number(enrollment.student_person_id);
    const sessionId = Number(enrollment.session_id);
    const programId = Number(enrollment.program_id);
    const matches = directAssignments.some((row) => Number(row.student_person_id) === studentPersonId
      && Number(row.session_id) === sessionId
      && Number(row.program_id) === programId);
    return matches ? [{ studentPersonId, sessionId, programId }] : [];
  });

  return {
    groupIds: finiteIds([
      ...(primary.data ?? []).map((row) => row.id),
      ...validCurriculumGroupIds,
      ...(timetable.data ?? []).map((row) => row.group_id)
    ]),
    studentPersonIds: finiteIds(validDirectAssignments.map((assignment) => assignment.studentPersonId)),
    studentAssignments: validDirectAssignments
  };
}

async function loadAssignedEnrollments(
  workspace: TeacherScopeWorkspace,
  teacherPersonId: number,
  personId?: number,
  admin: AdminClient = createAdminClient()
): Promise<TeacherAssignedEnrollment[]> {
  if (!workspace.branchId) return [];
  const scope = await getTeacherAssignmentScope(workspace, teacherPersonId, admin);
  if (!scope.groupIds.length && !scope.studentPersonIds.length) return [];

  const select = "id,student_person_id,session_id,program_id,group_id,status";
  let groupQuery = scope.groupIds.length
    ? admin.from("enrollments").select(select)
      .eq("tenant_id", workspace.tenantId)
      .eq("branch_id", workspace.branchId)
      .eq("status", "active")
      .in("group_id", scope.groupIds)
    : null;
  let studentQuery = scope.studentPersonIds.length
    ? admin.from("enrollments").select(select)
      .eq("tenant_id", workspace.tenantId)
      .eq("branch_id", workspace.branchId)
      .eq("status", "active")
      .in("student_person_id", scope.studentPersonIds)
    : null;

  if (personId) {
    groupQuery = groupQuery?.eq("student_person_id", personId) ?? null;
    studentQuery = studentQuery?.eq("student_person_id", personId) ?? null;
  }

  const [groupResult, studentResult] = await Promise.all([
    groupQuery ?? Promise.resolve({ data: [], error: null }),
    studentQuery ?? Promise.resolve({ data: [], error: null })
  ]);
  if (groupResult.error || studentResult.error) throw new Error("Unable to load assigned students.");

  const byId = new Map<number, TeacherAssignedEnrollment>();
  for (const row of groupResult.data ?? []) {
    byId.set(Number(row.id), row as TeacherAssignedEnrollment);
  }
  for (const row of studentResult.data ?? []) {
    const matches = scope.studentAssignments.some((assignment) => assignment.studentPersonId === Number(row.student_person_id)
      && assignment.sessionId === Number(row.session_id)
      && assignment.programId === Number(row.program_id));
    if (matches) byId.set(Number(row.id), row as TeacherAssignedEnrollment);
  }
  return [...byId.values()];
}

export async function getTeacherAssignedEnrollments(
  workspace: TeacherScopeWorkspace,
  teacherPersonId: number,
  admin: AdminClient = createAdminClient()
): Promise<TeacherAssignedEnrollment[]> {
  return loadAssignedEnrollments(workspace, teacherPersonId, undefined, admin);
}

export async function getTeacherAssignedEnrollment(
  workspace: TeacherScopeWorkspace,
  teacherPersonId: number,
  personId: number,
  admin: AdminClient = createAdminClient()
): Promise<TeacherAssignedEnrollment | null> {
  const rows = await loadAssignedEnrollments(workspace, teacherPersonId, personId, admin);
  return rows.sort((a, b) => b.id - a.id)[0] ?? null;
}

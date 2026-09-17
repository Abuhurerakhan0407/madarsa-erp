import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTeacherAssignedEnrollments } from "@/lib/students/teacher-scope";

type Raw = Record<string, unknown>;
type AdminClient = ReturnType<typeof createAdminClient>;

const num = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const raw = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const ids = (values: unknown[]): number[] => [...new Set(values.map(num).filter((value): value is number => value !== null))];

export type PortalTeacherEmployment = {
  employmentId: number;
  branchId: number;
  employeeNumber: string;
  designation: string | null;
  state: string;
};

export type PortalTeacherStudent = {
  enrollmentId: number;
  personId: number;
  studentNumber: string;
  displayName: string;
  nativeName: string | null;
  branchId: number;
  sessionId: number | null;
  programId: number | null;
  groupId: number | null;
  programLabels: Raw;
  groupLabels: Raw;
};

export type PortalTeacherScheduleItem = {
  id: number;
  branchId: number;
  weekday: number;
  startsAt: string;
  endsAt: string;
  groupId: number;
  groupLabels: Raw;
  subjectId: number;
  subjectLabels: Raw;
  room: string | null;
};

export type PortalTeacherHomework = {
  id: number;
  branchId: number;
  groupId: number;
  groupLabels: Raw;
  subjectId: number | null;
  subjectLabels: Raw;
  title: Raw | string;
  instructions: Raw | string;
  dueAt: string;
  state: string;
};

export type PortalTeacherQuranAttempt = {
  id: number;
  branchId: number;
  studentPersonId: number;
  studentName: string;
  workCategory: string;
  overallScore: number | null;
  outcome: string;
  teacherRemark: string | null;
  occurredAt: string;
};

export type PortalTeacherCapabilities = {
  studentRead: boolean;
  attendanceMark: boolean;
  quranRecord: boolean;
  homeworkManage: boolean;
  marksManage: boolean;
};

export type PortalTeacherWorkspace = {
  teacherPersonId: number;
  employments: PortalTeacherEmployment[];
  students: PortalTeacherStudent[];
  schedule: PortalTeacherScheduleItem[];
  homework: PortalTeacherHomework[];
  quran: PortalTeacherQuranAttempt[];
  capabilities: PortalTeacherCapabilities;
};

async function permission(
  admin: AdminClient,
  identityId: string,
  tenantId: number,
  branchId: number,
  permissionCode: string
): Promise<boolean> {
  const result = await admin.rpc("operator_has_permission_v1", {
    p_identity_id: identityId,
    p_tenant_id: tenantId,
    p_branch_id: branchId,
    p_permission_code: permissionCode
  });
  return result.error ? false : result.data === true;
}

export async function getPortalTeacherWorkspace(tenantId: number): Promise<PortalTeacherWorkspace | null> {
  const identity = await getVerifiedIdentity();
  if (!identity) return null;
  const admin = createAdminClient();

  const teacherLink = await admin.from("identity_person_links")
    .select("person_id")
    .eq("tenant_id", tenantId)
    .eq("identity_id", identity.id)
    .eq("link_type", "employee")
    .eq("status", "verified")
    .limit(1)
    .maybeSingle();
  if (teacherLink.error) throw new Error(`Unable to resolve teacher portal identity: ${teacherLink.error.message}`);
  const teacherPersonId = num(teacherLink.data?.person_id);
  if (!teacherPersonId) return null;

  const employmentResult = await admin.from("hr_employments")
    .select("id,branch_id,employee_number,designation_key,state")
    .eq("tenant_id", tenantId)
    .eq("employee_person_id", teacherPersonId)
    .in("state", ["active", "on_leave"]);
  if (employmentResult.error) throw new Error(`Unable to load teacher employment: ${employmentResult.error.message}`);

  const employments: PortalTeacherEmployment[] = (employmentResult.data ?? []).flatMap((item) => {
    const employmentId = num(item.id);
    const branchId = num(item.branch_id);
    if (!employmentId || !branchId) return [];
    return [{
      employmentId,
      branchId,
      employeeNumber: text(item.employee_number) ?? "—",
      designation: text(item.designation_key)?.replaceAll("_", " ") ?? null,
      state: text(item.state) ?? "active"
    }];
  });
  if (!employments.length) return null;

  const scopedEnrollments = (await Promise.all(employments.map(async (employment) => {
    const workspace = { tenantId, branchId: employment.branchId, identityId: identity.id };
    const rows = await getTeacherAssignedEnrollments(workspace, teacherPersonId, admin);
    return rows.map((enrollment) => ({ ...enrollment, branchId: employment.branchId }));
  }))).flat();

  const uniqueEnrollments = [...new Map(scopedEnrollments.map((item) => [`${item.branchId}:${item.id}`, item])).values()];
  const studentPersonIds = ids(uniqueEnrollments.map((item) => item.student_person_id));
  const groupIds = ids(uniqueEnrollments.map((item) => item.group_id));
  const programIds = ids(uniqueEnrollments.map((item) => item.program_id));
  const branchIds = ids(employments.map((item) => item.branchId));

  const [personsResult, profilesResult, groupsResult, programsResult] = await Promise.all([
    studentPersonIds.length
      ? admin.from("persons").select("id,display_name,name_native").eq("tenant_id", tenantId).in("id", studentPersonIds)
      : Promise.resolve({ data: [], error: null }),
    studentPersonIds.length
      ? admin.from("student_profiles").select("person_id,student_number,status").eq("tenant_id", tenantId).in("person_id", studentPersonIds)
      : Promise.resolve({ data: [], error: null }),
    groupIds.length
      ? admin.from("academic_groups").select("id,branch_id,labels,program_id,session_id").eq("tenant_id", tenantId).in("id", groupIds)
      : Promise.resolve({ data: [], error: null }),
    programIds.length
      ? admin.from("programs").select("id,labels").eq("tenant_id", tenantId).in("id", programIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (personsResult.error || profilesResult.error || groupsResult.error || programsResult.error) {
    throw new Error("Unable to load assigned teacher students.");
  }

  const personById = new Map((personsResult.data ?? []).map((item) => [Number(item.id), item]));
  const profileById = new Map((profilesResult.data ?? []).map((item) => [Number(item.person_id), item]));
  const groupById = new Map((groupsResult.data ?? []).map((item) => [Number(item.id), item]));
  const programById = new Map((programsResult.data ?? []).map((item) => [Number(item.id), item]));

  const students: PortalTeacherStudent[] = uniqueEnrollments.flatMap((enrollment) => {
    const personId = num(enrollment.student_person_id);
    const branchId = num(enrollment.branchId);
    if (!personId || !branchId) return [];
    const person = personById.get(personId);
    const profile = profileById.get(personId);
    if (!person || !profile) return [];
    const groupId = num(enrollment.group_id);
    const programId = num(enrollment.program_id);
    const group = groupId ? groupById.get(groupId) : null;
    if (group && Number(group.branch_id) !== branchId) return [];
    return [{
      enrollmentId: Number(enrollment.id),
      personId,
      studentNumber: text(profile.student_number) ?? "—",
      displayName: text(person.display_name) ?? "—",
      nativeName: text(person.name_native),
      branchId,
      sessionId: num(enrollment.session_id),
      programId,
      groupId,
      programLabels: raw(programId ? programById.get(programId)?.labels : null),
      groupLabels: raw(group?.labels)
    }];
  }).sort((a, b) => a.displayName.localeCompare(b.displayName));

  const timetableResult = await admin.from("timetable_entries")
    .select("id,branch_id,weekday,slot_id,group_id,subject_id,room_key,effective_from,effective_to,status")
    .eq("tenant_id", tenantId)
    .eq("teacher_person_id", teacherPersonId)
    .in("branch_id", branchIds)
    .eq("status", "active");
  if (timetableResult.error) throw new Error(`Unable to load teacher timetable: ${timetableResult.error.message}`);

  const timetableRows = timetableResult.data ?? [];
  const slotIds = ids(timetableRows.map((item) => item.slot_id));
  const timetableGroupIds = ids(timetableRows.map((item) => item.group_id));
  const subjectIds = ids(timetableRows.map((item) => item.subject_id));
  const [slotsResult, timetableGroupsResult, subjectsResult] = await Promise.all([
    slotIds.length
      ? admin.from("timetable_slots").select("id,starts_at,ends_at,sequence").eq("tenant_id", tenantId).in("id", slotIds)
      : Promise.resolve({ data: [], error: null }),
    timetableGroupIds.length
      ? admin.from("academic_groups").select("id,branch_id,labels").eq("tenant_id", tenantId).in("id", timetableGroupIds)
      : Promise.resolve({ data: [], error: null }),
    subjectIds.length
      ? admin.from("subjects").select("id,labels").eq("tenant_id", tenantId).in("id", subjectIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (slotsResult.error || timetableGroupsResult.error || subjectsResult.error) throw new Error("Unable to resolve teacher timetable.");
  const slotById = new Map((slotsResult.data ?? []).map((item) => [Number(item.id), item]));
  const timetableGroupById = new Map((timetableGroupsResult.data ?? []).map((item) => [Number(item.id), item]));
  const subjectById = new Map((subjectsResult.data ?? []).map((item) => [Number(item.id), item]));
  const today = new Date().toISOString().slice(0, 10);

  const schedule: PortalTeacherScheduleItem[] = timetableRows.flatMap((item) => {
    const id = num(item.id), branchId = num(item.branch_id), groupId = num(item.group_id), subjectId = num(item.subject_id), slotId = num(item.slot_id);
    const weekday = Number(item.weekday);
    if (!id || !branchId || !groupId || !subjectId || !slotId || !Number.isInteger(weekday)) return [];
    const from = text(item.effective_from), to = text(item.effective_to);
    if (from && from > today) return [];
    if (to && to < today) return [];
    const slot = slotById.get(slotId), group = timetableGroupById.get(groupId), subject = subjectById.get(subjectId);
    if (!slot || !group || !subject || Number(group.branch_id) !== branchId) return [];
    return [{
      id,
      branchId,
      weekday,
      startsAt: text(slot.starts_at) ?? "",
      endsAt: text(slot.ends_at) ?? "",
      groupId,
      groupLabels: raw(group.labels),
      subjectId,
      subjectLabels: raw(subject.labels),
      room: text(item.room_key)
    }];
  }).sort((a, b) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt));

  const homeworkResult = await admin.from("homework_assignments")
    .select("id,branch_id,group_id,subject_id,title,instructions,due_at,state,teacher_person_id")
    .eq("tenant_id", tenantId)
    .eq("teacher_person_id", teacherPersonId)
    .in("branch_id", branchIds)
    .in("state", ["draft", "published", "closed"])
    .gte("due_at", new Date(Date.now() - 14 * 86400000).toISOString())
    .order("due_at", { ascending: true })
    .limit(40);
  if (homeworkResult.error) throw new Error(`Unable to load teacher homework: ${homeworkResult.error.message}`);
  const homeworkGroups = ids((homeworkResult.data ?? []).map((item) => item.group_id));
  const homeworkSubjects = ids((homeworkResult.data ?? []).map((item) => item.subject_id));
  const [homeworkGroupsResult, homeworkSubjectsResult] = await Promise.all([
    homeworkGroups.length ? admin.from("academic_groups").select("id,branch_id,labels").eq("tenant_id", tenantId).in("id", homeworkGroups) : Promise.resolve({ data: [], error: null }),
    homeworkSubjects.length ? admin.from("subjects").select("id,labels").eq("tenant_id", tenantId).in("id", homeworkSubjects) : Promise.resolve({ data: [], error: null })
  ]);
  if (homeworkGroupsResult.error || homeworkSubjectsResult.error) throw new Error("Unable to resolve teacher homework context.");
  const homeworkGroupById = new Map((homeworkGroupsResult.data ?? []).map((item) => [Number(item.id), item]));
  const homeworkSubjectById = new Map((homeworkSubjectsResult.data ?? []).map((item) => [Number(item.id), item]));
  const homework: PortalTeacherHomework[] = (homeworkResult.data ?? []).flatMap((item) => {
    const id = num(item.id), branchId = num(item.branch_id), groupId = num(item.group_id);
    if (!id || !branchId || !groupId) return [];
    const group = homeworkGroupById.get(groupId);
    if (!group || Number(group.branch_id) !== branchId) return [];
    const subjectId = num(item.subject_id);
    return [{
      id,
      branchId,
      groupId,
      groupLabels: raw(group.labels),
      subjectId,
      subjectLabels: raw(subjectId ? homeworkSubjectById.get(subjectId)?.labels : null),
      title: typeof item.title === "string" ? item.title : raw(item.title),
      instructions: typeof item.instructions === "string" ? item.instructions : raw(item.instructions),
      dueAt: text(item.due_at) ?? "",
      state: text(item.state) ?? "draft"
    }];
  });

  let quran: PortalTeacherQuranAttempt[] = [];
  if (studentPersonIds.length) {
    const attemptResult = await admin.from("recitation_attempts")
      .select("id,recitation_session_id,student_person_id,work_category,overall_score,outcome,teacher_remark,occurred_at")
      .eq("tenant_id", tenantId)
      .in("student_person_id", studentPersonIds)
      .order("occurred_at", { ascending: false })
      .limit(200);
    if (attemptResult.error) throw new Error(`Unable to load teacher Qur'an context: ${attemptResult.error.message}`);
    const sessionIds = ids((attemptResult.data ?? []).map((item) => item.recitation_session_id));
    const sessionResult = sessionIds.length
      ? await admin.from("recitation_sessions").select("id,branch_id,teacher_person_id").eq("tenant_id", tenantId).in("id", sessionIds)
      : { data: [], error: null };
    if (sessionResult.error) throw new Error(`Unable to validate teacher Qur'an context: ${sessionResult.error.message}`);
    const allowedSessions = new Map((sessionResult.data ?? []).filter((item) => Number(item.teacher_person_id) === teacherPersonId && branchIds.includes(Number(item.branch_id))).map((item) => [Number(item.id), Number(item.branch_id)]));
    const studentNameById = new Map(students.map((student) => [student.personId, student.displayName]));
    const latestByStudent = new Map<number, PortalTeacherQuranAttempt>();
    for (const item of attemptResult.data ?? []) {
      const id = num(item.id), sessionId = num(item.recitation_session_id), studentPersonId = num(item.student_person_id);
      if (!id || !sessionId || !studentPersonId || latestByStudent.has(studentPersonId)) continue;
      const branchId = allowedSessions.get(sessionId);
      if (!branchId || !studentNameById.has(studentPersonId)) continue;
      latestByStudent.set(studentPersonId, {
        id,
        branchId,
        studentPersonId,
        studentName: studentNameById.get(studentPersonId) ?? "—",
        workCategory: text(item.work_category) ?? "—",
        overallScore: Number.isFinite(Number(item.overall_score)) ? Number(item.overall_score) : null,
        outcome: text(item.outcome) ?? "—",
        teacherRemark: text(item.teacher_remark),
        occurredAt: text(item.occurred_at) ?? ""
      });
    }
    quran = [...latestByStudent.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  const branchCapabilityRows = await Promise.all(branchIds.map(async (branchId) => ({
    studentRead: await permission(admin, identity.id, tenantId, branchId, "students.profile.read"),
    attendanceMark: await permission(admin, identity.id, tenantId, branchId, "attendance.student.mark"),
    quranRecord: await permission(admin, identity.id, tenantId, branchId, "learning.recitation.record"),
    homeworkManage: await permission(admin, identity.id, tenantId, branchId, "academics.homework.manage"),
    marksManage: await permission(admin, identity.id, tenantId, branchId, "assessment.marks.enter")
  })));
  const capabilities: PortalTeacherCapabilities = {
    studentRead: branchCapabilityRows.some((item) => item.studentRead),
    attendanceMark: branchCapabilityRows.some((item) => item.attendanceMark),
    quranRecord: branchCapabilityRows.some((item) => item.quranRecord),
    homeworkManage: branchCapabilityRows.some((item) => item.homeworkManage),
    marksManage: branchCapabilityRows.some((item) => item.marksManage)
  };

  return { teacherPersonId, employments, students, schedule, homework, quran, capabilities };
}

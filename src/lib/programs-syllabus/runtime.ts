import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenancy/context";

export type ProgramsSyllabusWorkspace = {
  programs: Array<{
    id: number;
    key: string;
    label: string;
    nativeLabel: string;
    description: string;
    programType: string;
    templateKey: string;
    status: string;
  }>;
  levels: Array<{ id: number; programId: number; key: string; label: string; sequence: number }>;
  versions: Array<{ id: number; programId: number; version: number; state: string; publishedAt: string | null }>;
  items: Array<{
    id: number;
    curriculumVersionId: number;
    programId: number;
    levelId: number | null;
    subjectId: number;
    subjectKey: string;
    subjectLabel: string;
    progressMethod: string;
    unitStructure: string;
    sequence: number;
  }>;
  units: Array<{
    id: number;
    curriculumItemId: number;
    parentUnitId: number | null;
    key: string;
    label: string;
    sequence: number;
    expectedPeriods: number | null;
  }>;
  sessions: Array<{ id: number; key: string; label: string; startsOn: string; endsOn: string; isDefault: boolean }>;
  groups: Array<{ id: number; sessionId: number; programId: number; key: string; label: string }>;
  teachers: Array<{ personId: number; name: string; employeeNumber: string }>;
  students: Array<{ personId: number; name: string; studentNumber: string; sessionId: number; programId: number; groupId: number | null }>;
  assignments: Array<{
    id: number;
    sessionId: number;
    programId: number;
    curriculumItemId: number;
    groupId: number | null;
    studentPersonId: number | null;
    teacherPersonId: number | null;
    evaluationMethod: string;
    startsOn: string;
    endsOn: string | null;
  }>;
};

type Labels = Record<string, string> | null;

function localized(labels: Labels, locale: string): string {
  if (!labels) return "";
  return labels[locale] || labels.en || Object.values(labels)[0] || "";
}

export async function getProgramsSyllabusWorkspace(locale: string): Promise<ProgramsSyllabusWorkspace> {
  const workspace = await getTenantContext();
  if (!workspace) throw new Error("Tenant context is required for Programs & Syllabus.");
  const supabase = await createClient();

  const [programsResult, levelsResult, versionsResult, subjectsResult, itemsResult, unitsResult, sessionsResult, groupsResult, employeesResult, enrollmentsResult, assignmentsResult] = await Promise.all([
    supabase.from("programs").select("id,key,labels,descriptions,program_type,template_key,status").eq("tenant_id", workspace.tenantId).order("id"),
    supabase.from("academic_levels").select("id,program_id,key,labels,sequence,status").eq("tenant_id", workspace.tenantId).eq("status", "active").order("program_id").order("sequence"),
    supabase.from("curriculum_versions").select("id,program_id,version,state,published_at").eq("tenant_id", workspace.tenantId).order("program_id").order("version", { ascending: false }),
    supabase.from("subjects").select("id,key,labels,status").eq("tenant_id", workspace.tenantId).eq("status", "active"),
    supabase.from("curriculum_version_items").select("id,curriculum_version_id,level_id,subject_id,sequence,progress_method,unit_structure").eq("tenant_id", workspace.tenantId).order("sequence"),
    supabase.from("curriculum_units").select("id,curriculum_item_id,parent_unit_id,key,labels,sequence,expected_periods").eq("tenant_id", workspace.tenantId).order("sequence"),
    supabase.from("academic_sessions").select("id,key,labels,starts_on,ends_on,is_default,status").eq("tenant_id", workspace.tenantId).eq("status", "active").order("starts_on", { ascending: false }),
    supabase.from("academic_groups").select("id,session_id,program_id,key,labels,status").eq("tenant_id", workspace.tenantId).eq("status", "active").order("key"),
    supabase.from("employee_profiles").select("person_id,employee_number,status").eq("tenant_id", workspace.tenantId).eq("status", "active").order("employee_number"),
    supabase.from("enrollments").select("student_person_id,session_id,program_id,group_id,status").eq("tenant_id", workspace.tenantId).eq("status", "active"),
    supabase.from("curriculum_teaching_assignments").select("id,session_id,program_id,curriculum_item_id,group_id,student_person_id,teacher_person_id,evaluation_method,starts_on,ends_on,status").eq("tenant_id", workspace.tenantId).eq("status", "active").order("id", { ascending: false })
  ]);

  const results = [programsResult, levelsResult, versionsResult, subjectsResult, itemsResult, unitsResult, sessionsResult, groupsResult, employeesResult, enrollmentsResult, assignmentsResult];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(`Unable to load Programs & Syllabus: ${failed.error.message}`);

  const personIds = Array.from(new Set([
    ...(employeesResult.data ?? []).map((row) => Number(row.person_id)),
    ...(enrollmentsResult.data ?? []).map((row) => Number(row.student_person_id))
  ])).filter((id) => Number.isInteger(id) && id > 0);

  const personsResult = personIds.length
    ? await supabase.from("persons").select("id,display_name,name_native").eq("tenant_id", workspace.tenantId).in("id", personIds)
    : { data: [], error: null };
  if (personsResult.error) throw new Error(`Unable to load Programs & Syllabus people: ${personsResult.error.message}`);

  const personMap = new Map((personsResult.data ?? []).map((person) => [Number(person.id), String(person.display_name || person.name_native || `Person ${person.id}`)]));
  const subjectMap = new Map((subjectsResult.data ?? []).map((subject) => [Number(subject.id), { key: String(subject.key), label: localized(subject.labels as Labels, locale) }]));
  const versionProgramMap = new Map((versionsResult.data ?? []).map((version) => [Number(version.id), Number(version.program_id)]));

  return {
    programs: (programsResult.data ?? []).map((program) => ({
      id: Number(program.id),
      key: String(program.key),
      label: localized(program.labels as Labels, locale),
      nativeLabel: localized(program.labels as Labels, locale === "en" ? "ur" : locale),
      description: localized(program.descriptions as Labels, locale),
      programType: String(program.program_type),
      templateKey: String(program.template_key),
      status: String(program.status)
    })),
    levels: (levelsResult.data ?? []).map((level) => ({
      id: Number(level.id),
      programId: Number(level.program_id),
      key: String(level.key),
      label: localized(level.labels as Labels, locale),
      sequence: Number(level.sequence)
    })),
    versions: (versionsResult.data ?? []).map((version) => ({
      id: Number(version.id),
      programId: Number(version.program_id),
      version: Number(version.version),
      state: String(version.state),
      publishedAt: version.published_at ? String(version.published_at) : null
    })),
    items: (itemsResult.data ?? []).map((item) => {
      const subject = subjectMap.get(Number(item.subject_id));
      return {
        id: Number(item.id),
        curriculumVersionId: Number(item.curriculum_version_id),
        programId: versionProgramMap.get(Number(item.curriculum_version_id)) ?? 0,
        levelId: item.level_id === null ? null : Number(item.level_id),
        subjectId: Number(item.subject_id),
        subjectKey: subject?.key ?? `subject_${item.subject_id}`,
        subjectLabel: subject?.label ?? `Subject ${item.subject_id}`,
        progressMethod: String(item.progress_method),
        unitStructure: String(item.unit_structure),
        sequence: Number(item.sequence)
      };
    }),
    units: (unitsResult.data ?? []).map((unit) => ({
      id: Number(unit.id),
      curriculumItemId: Number(unit.curriculum_item_id),
      parentUnitId: unit.parent_unit_id === null ? null : Number(unit.parent_unit_id),
      key: String(unit.key),
      label: localized(unit.labels as Labels, locale),
      sequence: Number(unit.sequence),
      expectedPeriods: unit.expected_periods === null ? null : Number(unit.expected_periods)
    })),
    sessions: (sessionsResult.data ?? []).map((session) => ({
      id: Number(session.id),
      key: String(session.key),
      label: localized(session.labels as Labels, locale),
      startsOn: String(session.starts_on),
      endsOn: String(session.ends_on),
      isDefault: Boolean(session.is_default)
    })),
    groups: (groupsResult.data ?? []).map((group) => ({
      id: Number(group.id),
      sessionId: Number(group.session_id),
      programId: Number(group.program_id),
      key: String(group.key),
      label: localized(group.labels as Labels, locale)
    })),
    teachers: (employeesResult.data ?? []).map((employee) => ({
      personId: Number(employee.person_id),
      name: personMap.get(Number(employee.person_id)) ?? `Teacher ${employee.employee_number}`,
      employeeNumber: String(employee.employee_number)
    })),
    students: (enrollmentsResult.data ?? []).map((enrollment) => ({
      personId: Number(enrollment.student_person_id),
      name: personMap.get(Number(enrollment.student_person_id)) ?? `Student ${enrollment.student_person_id}`,
      studentNumber: "",
      sessionId: Number(enrollment.session_id),
      programId: Number(enrollment.program_id),
      groupId: enrollment.group_id === null ? null : Number(enrollment.group_id)
    })),
    assignments: (assignmentsResult.data ?? []).map((assignment) => ({
      id: Number(assignment.id),
      sessionId: Number(assignment.session_id),
      programId: Number(assignment.program_id),
      curriculumItemId: Number(assignment.curriculum_item_id),
      groupId: assignment.group_id === null ? null : Number(assignment.group_id),
      studentPersonId: assignment.student_person_id === null ? null : Number(assignment.student_person_id),
      teacherPersonId: assignment.teacher_person_id === null ? null : Number(assignment.teacher_person_id),
      evaluationMethod: String(assignment.evaluation_method),
      startsOn: String(assignment.starts_on),
      endsOn: assignment.ends_on === null ? null : String(assignment.ends_on)
    }))
  };
}

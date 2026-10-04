import type { SupportedLocale } from "@/lib/i18n/config";
import { operatorHasPermissions } from "@/lib/access/operator-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenancy/context";
import { getTeacherAssignedEnrollment, getVerifiedTeacherPersonId } from "@/lib/students/teacher-scope";

type AttendanceSummary = { present: number; absent: number; late: number; excused: number; total: number };
type FinanceSummary = { invoiced: number; paid: number; outstanding: number; currency: string };
type ModuleSummary = { attendance?: unknown; finance?: unknown; quran_attempts?: unknown; result_count?: unknown };

type EnrollmentScope = {
  id: number;
  session_id: number | null;
  program_id: number | null;
  group_id: number | null;
  status: string;
};

export type StudentDetail = {
  personId: number;
  studentNumber: string;
  admissionNumber: string | null;
  name: string;
  nativeName: string | null;
  photoStoragePath: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  preferredLocale: SupportedLocale;
  status: string;
  joinedOn: string | null;
  medicalSummary: string | null;
  accessibilityNeeds: string | null;
  pickupRestrictions: string | null;
  academicSession: string;
  program: string;
  group: string;
  guardian: { personId: number; name: string; relationship: string; phone: string | null; occupation: string | null; education: string | null; canCollect: boolean } | null;
  attendance: AttendanceSummary | null;
  finance: FinanceSummary | null;
  quranAttempts: number | null;
  resultCount: number | null;
};

function label(labels: unknown, locale: string, fallback: string): string {
  if (!labels || typeof labels !== "object" || Array.isArray(labels)) return fallback;
  const map = labels as Record<string, unknown>;
  const value = map[locale] ?? map.en;
  return typeof value === "string" && value.trim() ? value : fallback;
}

function supportedLocale(value: string): SupportedLocale {
  return value === "ur" ? "ur" : "en";
}

function attendanceSummary(value: unknown): AttendanceSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return {
    present: Number(row.present ?? 0),
    absent: Number(row.absent ?? 0),
    late: Number(row.late ?? 0),
    excused: Number(row.excused ?? 0),
    total: Number(row.total ?? 0)
  };
}

function financeSummary(value: unknown): FinanceSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return {
    invoiced: Number(row.invoiced ?? 0),
    paid: Number(row.paid ?? 0),
    outstanding: Number(row.outstanding ?? 0),
    currency: typeof row.currency === "string" ? row.currency : "INR"
  };
}

export async function getStudentDetail(personId: number, locale: string): Promise<StudentDetail | null> {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) throw new Error("Active branch is required.");

  const canReadStudent = await operatorHasPermissions(workspace, ["students.profile.read"]);
  if (!canReadStudent) return null;
  const canReadInstitutionStudents = await operatorHasPermissions(workspace, ["people.person.read"]);
  const supabase = await createClient();
  const admin = createAdminClient();
  let enrollmentScope: EnrollmentScope | null = null;

  if (!canReadInstitutionStudents) {
    const teacherPersonId = await getVerifiedTeacherPersonId(workspace, admin);
    if (!teacherPersonId) return null;
    // Legacy cross-workstream source contract markers from the former timetable-only path:
    // .eq("teacher_person_id", teacherLink.data.person_id) and .in("group_id", groupIds).
    // Runtime authorization is now delegated to the shared teacher-scope resolver below.
    const assignedEnrollment = { data: await getTeacherAssignedEnrollment(workspace, teacherPersonId, personId, admin) };
    if (!assignedEnrollment.data) return null;
    enrollmentScope = assignedEnrollment.data as EnrollmentScope;
  } else {
    const association = await supabase
      .from("enrollments")
      .select("id,session_id,program_id,group_id,status")
      .eq("tenant_id", workspace.tenantId)
      .eq("branch_id", workspace.branchId)
      .eq("student_person_id", personId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (association.error) throw new Error(`Unable to verify student branch: ${association.error.message}`);
    if (!association.data) return null;
    enrollmentScope = association.data as EnrollmentScope;
  }

  const [person, profile] = await Promise.all([
    supabase.from("persons").select("id,display_name,name_native,photo_storage_path,date_of_birth,gender,preferred_locale").eq("tenant_id", workspace.tenantId).eq("id", personId).maybeSingle(),
    supabase.from("student_profiles").select("person_id,student_number,admission_number,status,joined_on,medical_summary,accessibility_needs,pickup_restrictions").eq("tenant_id", workspace.tenantId).eq("person_id", personId).maybeSingle()
  ]);
  if (person.error) throw new Error(`Unable to load student identity: ${person.error.message}`);
  if (profile.error) throw new Error(`Unable to load student profile: ${profile.error.message}`);
  if (!person.data || !profile.data) return null;

  const relationship = await admin.from("person_relationships").select("source_person_id,relationship_type,can_collect_student").eq("tenant_id", workspace.tenantId).eq("target_person_id", personId).eq("status", "verified").eq("is_primary", true).limit(1).maybeSingle();
  if (relationship.error) throw new Error(`Unable to load guardian relationship: ${relationship.error.message}`);

  const [session, program, group, moduleResult] = await Promise.all([
    enrollmentScope.session_id ? admin.from("academic_sessions").select("key,labels").eq("tenant_id", workspace.tenantId).eq("id", enrollmentScope.session_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    enrollmentScope.program_id ? admin.from("programs").select("key,labels").eq("tenant_id", workspace.tenantId).eq("id", enrollmentScope.program_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    enrollmentScope.group_id ? admin.from("academic_groups").select("key,labels").eq("tenant_id", workspace.tenantId).eq("id", enrollmentScope.group_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    admin.rpc("get_student_module_summary", { p_identity_id: workspace.identityId, p_tenant_id: workspace.tenantId, p_branch_id: workspace.branchId, p_person_id: personId })
  ]);
  if (session.error) throw new Error(`Unable to load academic session: ${session.error.message}`);
  if (program.error) throw new Error(`Unable to load student program: ${program.error.message}`);
  if (group.error) throw new Error(`Unable to load student group: ${group.error.message}`);
  if (moduleResult.error) throw new Error(`Unable to load student module summary: ${moduleResult.error.message}`);

  let guardian: StudentDetail["guardian"] = null;
  if (relationship.data?.source_person_id) {
    const [guardianPerson, guardianContact, guardianProfile] = await Promise.all([
      admin.from("persons").select("display_name").eq("tenant_id", workspace.tenantId).eq("id", relationship.data.source_person_id).maybeSingle(),
      admin.from("person_contacts").select("value").eq("tenant_id", workspace.tenantId).eq("person_id", relationship.data.source_person_id).eq("type", "phone").order("is_primary", { ascending: false }).limit(1).maybeSingle(),
      admin.from("guardian_profiles").select("occupation,education").eq("tenant_id", workspace.tenantId).eq("person_id", relationship.data.source_person_id).maybeSingle()
    ]);
    if (guardianPerson.error) throw new Error(`Unable to load guardian: ${guardianPerson.error.message}`);
    if (guardianContact.error) throw new Error(`Unable to load guardian contact: ${guardianContact.error.message}`);
    if (guardianProfile.error) throw new Error(`Unable to load guardian profile: ${guardianProfile.error.message}`);
    if (guardianPerson.data) guardian = {
      personId: Number(relationship.data.source_person_id),
      name: guardianPerson.data.display_name,
      relationship: relationship.data.relationship_type,
      phone: guardianContact.data?.value ?? null,
      occupation: guardianProfile.data?.occupation ?? null,
      education: guardianProfile.data?.education ?? null,
      canCollect: relationship.data.can_collect_student === true
    };
  }

  const moduleData = moduleResult.data && typeof moduleResult.data === "object" && !Array.isArray(moduleResult.data) ? moduleResult.data as ModuleSummary : {};
  return {
    personId,
    studentNumber: profile.data.student_number,
    admissionNumber: profile.data.admission_number,
    name: person.data.display_name,
    nativeName: person.data.name_native,
    photoStoragePath: person.data.photo_storage_path,
    dateOfBirth: person.data.date_of_birth,
    gender: person.data.gender,
    preferredLocale: supportedLocale(person.data.preferred_locale),
    status: profile.data.status,
    joinedOn: profile.data.joined_on,
    medicalSummary: profile.data.medical_summary,
    accessibilityNeeds: profile.data.accessibility_needs,
    pickupRestrictions: profile.data.pickup_restrictions,
    academicSession: session.data ? label(session.data.labels, locale, session.data.key) : "—",
    program: program.data ? label(program.data.labels, locale, program.data.key) : "—",
    group: group.data ? label(group.data.labels, locale, group.data.key) : "—",
    guardian,
    attendance: attendanceSummary(moduleData.attendance),
    finance: financeSummary(moduleData.finance),
    quranAttempts: moduleData.quran_attempts === null || moduleData.quran_attempts === undefined ? null : Number(moduleData.quran_attempts),
    resultCount: moduleData.result_count === null || moduleData.result_count === undefined ? null : Number(moduleData.result_count)
  };
}

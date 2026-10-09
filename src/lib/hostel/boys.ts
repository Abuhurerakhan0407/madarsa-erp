import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";

type Raw = Record<string, unknown>;

const object = (value: unknown): Raw =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};

const rows = (value: unknown): Raw[] =>
  Array.isArray(value)
    ? value.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry)) as Raw[]
    : [];

const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const text = (value: unknown) => typeof value === "string" && value.trim() ? value : null;

export type HostelBoy = {
  personId: number;
  enrollmentId: number;
  displayName: string;
  nativeName: string | null;
  studentNumber: string | null;
  programId: number;
  programLabel: string;
  programLabelUr: string;
  groupId: number | null;
  groupLabel: string;
  groupLabelUr: string;
  status: string;
};

export type HostelBoysWorkspace = {
  students: HostelBoy[];
  availableStudents: HostelBoy[];
};

function mapStudent(row: Raw): HostelBoy {
  return {
    personId: number(row.person_id),
    enrollmentId: number(row.enrollment_id),
    displayName: text(row.display_name) ?? "Student",
    nativeName: text(row.name_native),
    studentNumber: text(row.student_number),
    programId: number(row.program_id),
    programLabel: text(row.program_label) ?? "Program",
    programLabelUr: text(row.program_label_ur) ?? text(row.program_label) ?? "پروگرام",
    groupId: row.group_id === null ? null : number(row.group_id),
    groupLabel: text(row.group_label) ?? "—",
    groupLabelUr: text(row.group_label_ur) ?? text(row.group_label) ?? "—",
    status: text(row.status) ?? "active"
  };
}

export async function getHostelBoysWorkspace(): Promise<HostelBoysWorkspace> {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) throw new Error("Active branch is required.");

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_hostel_boys_center_v1", {
    p_identity_id: workspace.identityId,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId
  });

  if (error) throw new Error("Unable to load hostel boys: " + error.message);

  return {
    students: rows(object(data).students).map(mapStudent),
    availableStudents: rows(object(data).available_students).map(mapStudent)
  };
}

export async function setStudentResidence(
  studentPersonId: number,
  residenceType: "day" | "hostel",
  reason?: string
) {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) throw new Error("Active branch is required.");

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("set_student_residence_v1", {
    p_identity_id: workspace.identityId,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_student_person_id: studentPersonId,
    p_residence_type: residenceType,
    p_reason: reason ?? null
  });

  if (error) throw new Error("Unable to update hostel status: " + error.message);
  return data;
}

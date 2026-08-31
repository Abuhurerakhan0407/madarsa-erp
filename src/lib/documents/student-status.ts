import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";

type Raw = Record<string, unknown>;

export type StudentStatusCertificateSnapshot = {
  studentPersonId: number;
  studentNumber: string;
  studentName: string;
  studentNameNative: string | null;
  studentStatus: string;
  joinedOn: string | null;
  tenantName: string;
  branchName: string;
  program: string;
  classGroup: string;
  academicSession: string;
  issuedOn: string;
};

export type StudentStatusCertificate = {
  issueId: number;
  documentId: number;
  revision: number;
  verificationCode: string;
  issuedAt: string;
  state: string;
  snapshot: StudentStatusCertificateSnapshot;
};

function obj(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
}
function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
function num(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mapCertificate(value: unknown): StudentStatusCertificate | null {
  const raw = obj(value);
  const snapshot = obj(raw.snapshot);
  const issueId = num(raw.issue_id);
  const documentId = num(raw.document_id);
  const revision = num(raw.revision);
  const verificationCode = str(raw.verification_code);
  const issuedAt = str(raw.issued_at);
  const studentPersonId = num(snapshot.student_person_id);
  const studentNumber = str(snapshot.student_number);
  const studentName = str(snapshot.student_name);
  const tenantName = str(snapshot.tenant_name);
  const branchName = str(snapshot.branch_name);
  const issuedOn = str(snapshot.issued_on);
  if (!issueId || !documentId || !revision || !verificationCode || !issuedAt || !studentPersonId || !studentNumber || !studentName || !tenantName || !branchName || !issuedOn) return null;
  return {
    issueId,
    documentId,
    revision,
    verificationCode,
    issuedAt,
    state: str(raw.state) ?? "active",
    snapshot: {
      studentPersonId,
      studentNumber,
      studentName,
      studentNameNative: str(snapshot.student_name_native),
      studentStatus: str(snapshot.student_status) ?? "active",
      joinedOn: str(snapshot.joined_on),
      tenantName,
      branchName,
      program: str(snapshot.program) ?? "—",
      classGroup: str(snapshot.class_group) ?? "—",
      academicSession: str(snapshot.academic_session) ?? "—",
      issuedOn
    }
  };
}

export async function getStudentStatusCertificate(personId: number): Promise<StudentStatusCertificate | null> {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) throw new Error("Active branch is required.");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_student_status_certificate_v1", {
    p_identity_id: workspace.identityId,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_student_person_id: personId
  });
  if (error) throw new Error(`Unable to load student status certificate: ${error.message}`);
  return mapCertificate(data);
}

export async function issueStudentStatusCertificate(personId: number, requestKey: string): Promise<StudentStatusCertificate> {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) throw new Error("Active branch is required.");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("issue_student_status_certificate_v1", {
    p_identity_id: workspace.identityId,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_student_person_id: personId,
    p_request_key: requestKey
  });
  if (error) throw new Error(`Unable to issue student status certificate: ${error.message}`);
  const certificate = mapCertificate(data);
  if (!certificate) throw new Error("Certificate runtime returned an invalid response.");
  return certificate;
}

export async function verifyStudentStatusCertificate(code: string): Promise<StudentStatusCertificate | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verify_student_status_certificate_v1", { p_verification_code: code });
  if (error) throw new Error("Unable to verify certificate.");
  return mapCertificate(data);
}

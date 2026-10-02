import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import type { StudentStatusCertificate } from "@/lib/documents/student-status";

type Raw = Record<string, unknown>;
const obj = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const num = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export type PortalGuardianDocumentChild = {
  personId: number;
  studentNumber: string;
  status: string;
  displayName: string;
  nativeName: string | null;
  dateOfBirth: string | null;
  photoStoragePath: string | null;
  guardianName: string | null;
  branchId: number;
  branchName: string;
  sessionLabel: string;
  programLabel: string;
  groupLabel: string;
  statusCertificate: StudentStatusCertificate | null;
};

function localized(value: unknown, fallback = "—"): string {
  const labels = obj(value);
  return text(labels.en) ?? text(labels.ur) ?? fallback;
}
function mapCertificate(value: unknown): StudentStatusCertificate | null {
  const row = obj(value);
  const snapshot = obj(row.snapshot);
  const issueId = num(row.issue_id);
  const documentId = num(row.document_id);
  const revision = num(row.revision);
  const verificationCode = text(row.verification_code);
  const issuedAt = text(row.issued_at);
  const studentPersonId = num(snapshot.student_person_id);
  const studentNumber = text(snapshot.student_number);
  const studentName = text(snapshot.student_name);
  const tenantName = text(snapshot.tenant_name);
  const branchName = text(snapshot.branch_name);
  const issuedOn = text(snapshot.issued_on);
  if (!issueId || !documentId || !revision || !verificationCode || !issuedAt || !studentPersonId || !studentNumber || !studentName || !tenantName || !branchName || !issuedOn) return null;
  return {
    issueId,
    documentId,
    revision,
    verificationCode,
    issuedAt,
    state: text(row.state) ?? "active",
    snapshot: {
      studentPersonId,
      studentNumber,
      studentName,
      studentNameNative: text(snapshot.student_name_native),
      studentStatus: text(snapshot.student_status) ?? "active",
      joinedOn: text(snapshot.joined_on),
      tenantName,
      branchName,
      program: text(snapshot.program) ?? "—",
      classGroup: text(snapshot.class_group) ?? "—",      academicSession: text(snapshot.academic_session) ?? "—",
      issuedOn
    }
  };
}

export async function getPortalGuardianDocuments(tenantId: number): Promise<PortalGuardianDocumentChild[]> {
  const identity = await getVerifiedIdentity();
  if (!identity) return [];
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_portal_guardian_documents_v1", {
    p_identity_id: identity.id,
    p_tenant_id: tenantId
  });
  if (error) throw new Error(`Unable to load portal documents: ${error.message}`);
  const root = obj(data);
  const children = Array.isArray(root.children) ? root.children : [];
  return children.flatMap((value) => {
    const row = obj(value);
    const personId = num(row.person_id);
    const branchId = num(row.branch_id);
    const studentNumber = text(row.student_number);
    const displayName = text(row.display_name);
    if (!personId || !branchId || !studentNumber || !displayName) return [];
    return [{
      personId,
      studentNumber,
      status: text(row.status) ?? "active",
      displayName,
      nativeName: text(row.name_native),
      dateOfBirth: text(row.date_of_birth),
      photoStoragePath: text(row.photo_storage_path),
      guardianName: text(row.guardian_name),
      branchId,
      branchName: text(row.branch_name) ?? "Main Branch",
      sessionLabel: localized(row.session_labels, "Current academic year"),
      programLabel: localized(row.program_labels),
      groupLabel: localized(row.group_labels),
      statusCertificate: mapCertificate(row.status_certificate)
    }];
  });
}

import { operatorHasPermissions } from "@/lib/access/operator-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TenantContext } from "@/lib/tenancy/context";

type Labels = Record<string, string>;

export type StaffAdmissionDraftListItem = {
  id: number;
  revision: number;
  applicantName: string;
  updatedAt: string;
  programLabels: Labels | null;
  sessionLabels: Labels | null;
};

export type StaffAdmissionDraft = {
  id: number;
  revision: number;
  preferredLocale: "en" | "ur";
  sessionId: number;
  programId: number;
  groupKey: string | null;
  displayName: string;
  nameNative: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other" | "undisclosed" | "";
  joinedOn: string;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
  guardianRelationship: "father" | "mother" | "guardian" | "other";
  medicalSummary: string;
  accessibilityNeeds: string;
  pickupRestrictions: string;
  photoBound: boolean;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isStaffDraft(consent: unknown): boolean {
  return objectValue(consent).staff_draft === true;
}

function labels(value: unknown): Labels | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Labels)
    : null;
}

export async function listStaffAdmissionDrafts(
  workspace: TenantContext
): Promise<StaffAdmissionDraftListItem[]> {
  if (!workspace.branchId) return [];
  if (!(await operatorHasPermissions(workspace, ["admissions.application.review"]))) {
    throw new Error("Admission draft permission required.");
  }

  const admin = createAdminClient();
  const { data: applications, error } = await admin
    .from("applications")
    .select(
      "id,revision,applicant_data,program_id,session_id,consent,updated_at,created_at"
    )
    .eq("tenant_id", workspace.tenantId)
    .eq("branch_id", workspace.branchId)
    .eq("state", "draft")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Unable to load admission drafts: ${error.message}`);
  }

  const drafts = (applications ?? []).filter((row) => isStaffDraft(row.consent));
  if (!drafts.length) return [];

  const programIds = [...new Set(drafts.map((row) => row.program_id).filter(Boolean))];
  const sessionIds = [...new Set(drafts.map((row) => row.session_id).filter(Boolean))];

  const [programResult, sessionResult] = await Promise.all([
    programIds.length
      ? admin
          .from("programs")
          .select("id,labels")
          .eq("tenant_id", workspace.tenantId)
          .in("id", programIds)
      : Promise.resolve({ data: [], error: null }),
    sessionIds.length
      ? admin
          .from("academic_sessions")
          .select("id,labels")
          .eq("tenant_id", workspace.tenantId)
          .in("id", sessionIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (programResult.error) {
    throw new Error(`Unable to load admission draft programs: ${programResult.error.message}`);
  }
  if (sessionResult.error) {
    throw new Error(`Unable to load admission draft sessions: ${sessionResult.error.message}`);
  }

  const programs = new Map(
    (programResult.data ?? []).map((row) => [row.id, labels(row.labels)])
  );
  const sessions = new Map(
    (sessionResult.data ?? []).map((row) => [row.id, labels(row.labels)])
  );

  return drafts.map((row) => {
    const applicant = objectValue(row.applicant_data);
    return {
      id: row.id,
      revision: row.revision,
      applicantName: textValue(applicant.applicant_name) || "Draft admission",
      updatedAt: row.updated_at || row.created_at,
      programLabels: programs.get(row.program_id) ?? null,
      sessionLabels: sessions.get(row.session_id) ?? null
    };
  });
}

export async function getStaffAdmissionDraft(
  workspace: TenantContext,
  applicationId: number
): Promise<StaffAdmissionDraft | null> {
  if (!workspace.branchId || !Number.isSafeInteger(applicationId) || applicationId <= 0) {
    return null;
  }
  if (!(await operatorHasPermissions(workspace, ["admissions.application.review"]))) {
    return null;
  }

  const admin = createAdminClient();
  const { data: application, error } = await admin
    .from("applications")
    .select(
      "id,revision,preferred_locale,session_id,program_id,applicant_data,consent,state"
    )
    .eq("tenant_id", workspace.tenantId)
    .eq("branch_id", workspace.branchId)
    .eq("id", applicationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load admission draft: ${error.message}`);
  }
  if (!application || application.state !== "draft" || !isStaffDraft(application.consent)) {
    return null;
  }

  const applicant = objectValue(application.applicant_data);
  const { data: photo, error: photoError } = await admin
    .from("public_admission_photo_uploads")
    .select("id")
    .eq("tenant_id", workspace.tenantId)
    .eq("application_id", application.id)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (photoError) {
    throw new Error(`Unable to load admission draft photo state: ${photoError.message}`);
  }

  const gender = textValue(applicant.gender);
  const relationship = textValue(applicant.guardian_relationship);

  return {
    id: application.id,
    revision: application.revision,
    preferredLocale: application.preferred_locale === "ur" ? "ur" : "en",
    sessionId: application.session_id,
    programId: application.program_id,
    groupKey: textValue(applicant.group_key) || null,
    displayName: textValue(applicant.applicant_name),
    nameNative: textValue(applicant.native_name),
    dateOfBirth: textValue(applicant.date_of_birth),
    gender:
      gender === "male" ||
      gender === "female" ||
      gender === "other" ||
      gender === "undisclosed"
        ? gender
        : "",
    joinedOn: textValue(applicant.joining_date),
    guardianName: textValue(applicant.guardian_name),
    guardianEmail: textValue(applicant.guardian_email),
    guardianPhone: textValue(applicant.guardian_phone),
    guardianRelationship:
      relationship === "father" ||
      relationship === "mother" ||
      relationship === "guardian" ||
      relationship === "other"
        ? relationship
        : "guardian",
    medicalSummary: textValue(applicant.medical_summary),
    accessibilityNeeds: textValue(applicant.accessibility_needs),
    pickupRestrictions: textValue(applicant.pickup_restrictions),
    photoBound: Boolean(photo?.id)
  };
}

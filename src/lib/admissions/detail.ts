import { createClient } from "@/lib/supabase/server";
import type { TenantContext } from "@/lib/tenancy/context";

type Labels = Record<string, string>;

type AdmissionReview = {
  id: number;
  reviewType: string;
  outcome: string;
  notes: string | null;
  reviewedRevision: number;
  createdAt: string;
};

type AdmissionDecisionRecord = {
  id: number;
  outcome: string;
  reason: string;
  applicationRevision: number;
  decidedAt: string;
};

export type ConvertedStudent = {
  personId: number;
  studentNumber: string;
  enrollmentId: number;
} | null;

export type AdmissionDetail = {
  id: number;
  trackingId: string;
  state: string;
  revision: number;
  preferredLocale: string;
  submittedAt: string | null;
  convertedAt: string | null;
  duplicateReviewStatus: string;
  applicantData: Record<string, string>;
  programLabels: Labels | null;
  sessionLabels: Labels | null;
  reviews: AdmissionReview[];
  decisions: AdmissionDecisionRecord[];
  convertedStudent: ConvertedStudent;
};

function stringAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, answer]) =>
      typeof answer === "string" ? [[key, answer]] : []
    )
  );
}

export async function getAdmissionDetail(
  workspace: TenantContext,
  applicationId: number
): Promise<AdmissionDetail | null> {
  if (!Number.isSafeInteger(applicationId) || applicationId <= 0) return null;

  const supabase = await createClient();
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("id, tracking_id, state, revision, preferred_locale, submitted_at, converted_at, duplicate_review_status, applicant_person_id, applicant_data, program_id, session_id, branch_id")
    .eq("tenant_id", workspace.tenantId)
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError) throw new Error(`Unable to load admission application: ${applicationError.message}`);
  if (!application) return null;

  const [programResult, sessionResult, reviewsResult, decisionsResult] = await Promise.all([
    supabase
      .from("programs")
      .select("labels")
      .eq("tenant_id", workspace.tenantId)
      .eq("id", application.program_id)
      .maybeSingle(),
    supabase
      .from("academic_sessions")
      .select("labels")
      .eq("tenant_id", workspace.tenantId)
      .eq("id", application.session_id)
      .maybeSingle(),
    supabase
      .from("application_reviews")
      .select("id, review_type, outcome, notes, reviewed_revision, created_at")
      .eq("tenant_id", workspace.tenantId)
      .eq("application_id", application.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("admission_decisions")
      .select("id, outcome, reason, application_revision, decided_at")
      .eq("tenant_id", workspace.tenantId)
      .eq("application_id", application.id)
      .order("decided_at", { ascending: false })
  ]);

  if (programResult.error) throw new Error(`Unable to load admission program: ${programResult.error.message}`);
  if (sessionResult.error) throw new Error(`Unable to load admission session: ${sessionResult.error.message}`);
  if (reviewsResult.error) throw new Error(`Unable to load admission reviews: ${reviewsResult.error.message}`);
  if (decisionsResult.error) throw new Error(`Unable to load admission decisions: ${decisionsResult.error.message}`);

  let convertedStudent: ConvertedStudent = null;
  if (application.applicant_person_id) {
    const [profileResult, enrollmentResult] = await Promise.all([
      supabase
        .from("student_profiles")
        .select("person_id, student_number")
        .eq("tenant_id", workspace.tenantId)
        .eq("person_id", application.applicant_person_id)
        .maybeSingle(),
      supabase
        .from("enrollments")
        .select("id")
        .eq("tenant_id", workspace.tenantId)
        .eq("student_person_id", application.applicant_person_id)
        .eq("branch_id", application.branch_id)
        .eq("session_id", application.session_id)
        .eq("program_id", application.program_id)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    if (profileResult.error) throw new Error(`Unable to load converted student profile: ${profileResult.error.message}`);
    if (enrollmentResult.error) throw new Error(`Unable to load converted enrollment: ${enrollmentResult.error.message}`);

    if (profileResult.data && enrollmentResult.data) {
      convertedStudent = {
        personId: profileResult.data.person_id,
        studentNumber: profileResult.data.student_number,
        enrollmentId: enrollmentResult.data.id
      };
    }
  }

  return {
    id: application.id,
    trackingId: application.tracking_id,
    state: application.state,
    revision: application.revision,
    preferredLocale: application.preferred_locale,
    submittedAt: application.submitted_at,
    convertedAt: application.converted_at,
    duplicateReviewStatus: application.duplicate_review_status,
    applicantData: stringAnswers(application.applicant_data),
    programLabels: (programResult.data?.labels as Labels | null | undefined) ?? null,
    sessionLabels: (sessionResult.data?.labels as Labels | null | undefined) ?? null,
    reviews: (reviewsResult.data ?? []).map((row) => ({
      id: row.id,
      reviewType: row.review_type,
      outcome: row.outcome,
      notes: row.notes,
      reviewedRevision: row.reviewed_revision,
      createdAt: row.created_at
    })),
    decisions: (decisionsResult.data ?? []).map((row) => ({
      id: row.id,
      outcome: row.outcome,
      reason: row.reason,
      applicationRevision: row.application_revision,
      decidedAt: row.decided_at
    })),
    convertedStudent
  };
}

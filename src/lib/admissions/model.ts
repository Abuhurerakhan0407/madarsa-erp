export const admissionStates = [
  "draft",
  "submitted",
  "verification",
  "assessment",
  "decision",
  "offered",
  "waitlisted",
  "rejected",
  "payment_pending",
  "enrolled",
  "expired",
  "withdrawn"
] as const;

export type AdmissionState = (typeof admissionStates)[number];

export type AdmissionApplication = {
  id: string;
  tenantId: string;
  trackingId: string;
  branchId: string;
  sessionId: string;
  programId: string;
  workflowVersionId: string;
  formVersionId: string;
  applicantPersonId?: string;
  guardianPersonId?: string;
  state: AdmissionState;
  revision: number;
  submittedAt?: string;
  convertedStudentPersonId?: string;
};

export type AdmissionDecision = {
  applicationId: string;
  outcome: "offered" | "waitlisted" | "rejected";
  reason: string;
  decidedByMembershipId: string;
  decidedAt: string;
  overrides: readonly string[];
};

export type AdmissionConversionRequest = {
  tenantId: string;
  applicationId: string;
  idempotencyKey: string;
  studentNumber: string;
  enrollmentProgramIds: readonly string[];
};

export type AdmissionConversionResult = {
  applicationId: string;
  studentPersonId: string;
  enrollmentIds: readonly string[];
  idempotencyKey: string;
};

export type DuplicateCandidate = {
  personId: string;
  normalizedPhone?: string;
  normalizedEmail?: string;
  identifier?: string;
  confidence: "possible" | "likely";
};

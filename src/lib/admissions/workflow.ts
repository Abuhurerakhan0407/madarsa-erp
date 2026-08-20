import type {
  AdmissionApplication,
  AdmissionConversionRequest,
  AdmissionConversionResult,
  AdmissionDecision,
  AdmissionState,
  DuplicateCandidate
} from "./model";

const transitions: Record<AdmissionState, readonly AdmissionState[]> = {
  draft: ["submitted", "withdrawn", "expired"],
  submitted: ["verification", "withdrawn"],
  verification: ["assessment", "decision", "withdrawn"],
  assessment: ["decision", "withdrawn"],
  decision: ["offered", "waitlisted", "rejected"],
  offered: ["payment_pending", "enrolled", "expired", "withdrawn"],
  waitlisted: ["offered", "rejected", "withdrawn", "expired"],
  rejected: [],
  payment_pending: ["enrolled", "expired", "withdrawn"],
  enrolled: [],
  expired: [],
  withdrawn: []
};

export function canTransitionAdmission(from: AdmissionState, to: AdmissionState): boolean {
  return transitions[from].includes(to);
}

export function transitionAdmission(
  application: AdmissionApplication,
  to: AdmissionState
): AdmissionApplication {
  if (!canTransitionAdmission(application.state, to)) {
    throw new Error(`Admission transition blocked: ${application.state} -> ${to}`);
  }

  return {
    ...application,
    state: to,
    revision: application.revision + 1,
    submittedAt: to === "submitted" ? new Date().toISOString() : application.submittedAt
  };
}

export function validateDecision(decision: AdmissionDecision): string[] {
  const issues: string[] = [];
  if (decision.reason.trim().length < 8) issues.push("reason_required");
  if (decision.overrides.length > 0 && decision.reason.trim().length < 20) {
    issues.push("override_reason_too_short");
  }
  return issues;
}

export function findDuplicateCandidates(
  input: { normalizedPhone?: string; normalizedEmail?: string; identifier?: string },
  candidates: readonly Omit<DuplicateCandidate, "confidence">[]
): DuplicateCandidate[] {
  return candidates.flatMap((candidate) => {
    const identifierMatch = Boolean(input.identifier && candidate.identifier === input.identifier);
    const contactMatch = Boolean(
      (input.normalizedPhone && candidate.normalizedPhone === input.normalizedPhone) ||
      (input.normalizedEmail && candidate.normalizedEmail === input.normalizedEmail)
    );
    if (!identifierMatch && !contactMatch) return [];
    return [{ ...candidate, confidence: identifierMatch && contactMatch ? "likely" : "possible" }];
  });
}

export function convertAdmission(
  request: AdmissionConversionRequest,
  existing: AdmissionConversionResult | undefined,
  create: () => AdmissionConversionResult
): AdmissionConversionResult {
  if (request.idempotencyKey.trim().length < 16) {
    throw new Error("Conversion idempotency key must contain at least 16 characters");
  }
  if (existing) {
    if (existing.applicationId !== request.applicationId || existing.idempotencyKey !== request.idempotencyKey) {
      throw new Error("Idempotency key collision");
    }
    return existing;
  }

  const result = create();
  if (
    result.applicationId !== request.applicationId ||
    result.idempotencyKey !== request.idempotencyKey ||
    result.enrollmentIds.length !== new Set(result.enrollmentIds).size
  ) {
    throw new Error("Invalid admission conversion result");
  }
  return result;
}

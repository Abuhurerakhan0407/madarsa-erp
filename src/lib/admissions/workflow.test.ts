import { describe, expect, it, vi } from "vitest";
import type { AdmissionApplication, AdmissionConversionResult } from "./model";
import { canTransitionAdmission, convertAdmission, findDuplicateCandidates, transitionAdmission, validateDecision } from "./workflow";

const application: AdmissionApplication = {
  id: "app-1",
  tenantId: "tenant-a",
  trackingId: "opaque-tracking-id",
  branchId: "branch-1",
  sessionId: "session-1",
  programId: "program-1",
  workflowVersionId: "workflow-v1",
  formVersionId: "form-v1",
  state: "draft",
  revision: 1
};

describe("admission workflow", () => {
  it("keeps fixed semantic transitions", () => {
    expect(canTransitionAdmission("draft", "submitted")).toBe(true);
    expect(canTransitionAdmission("submitted", "enrolled")).toBe(false);
    expect(canTransitionAdmission("rejected", "offered")).toBe(false);
  });

  it("increments revision during transitions", () => {
    expect(transitionAdmission(application, "submitted")).toMatchObject({ state: "submitted", revision: 2 });
  });

  it("requires stronger reasons for overrides", () => {
    expect(validateDecision({
      applicationId: "app-1",
      outcome: "offered",
      reason: "override",
      decidedByMembershipId: "member-1",
      decidedAt: new Date().toISOString(),
      overrides: ["capacity"]
    })).toContain("override_reason_too_short");
  });

  it("flags duplicates without auto-merging", () => {
    expect(findDuplicateCandidates(
      { normalizedPhone: "+919900000000", identifier: "ID-1" },
      [{ personId: "person-1", normalizedPhone: "+919900000000", identifier: "ID-1" }]
    )).toEqual([expect.objectContaining({ personId: "person-1", confidence: "likely" })]);
  });

  it("returns an existing conversion idempotently", () => {
    const existing: AdmissionConversionResult = {
      applicationId: "app-1",
      studentPersonId: "student-1",
      enrollmentIds: ["enrollment-1"],
      idempotencyKey: "conversion-key-0001"
    };
    const create = vi.fn(() => existing);
    expect(convertAdmission({
      tenantId: "tenant-a",
      applicationId: "app-1",
      idempotencyKey: "conversion-key-0001",
      studentNumber: "S-1",
      enrollmentProgramIds: ["program-1"]
    }, existing, create)).toBe(existing);
    expect(create).not.toHaveBeenCalled();
  });
});

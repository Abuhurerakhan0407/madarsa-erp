import { describe, expect, it } from "vitest";
import { validateAdmissionStaffAction } from "./staff-action-model";

describe("admission staff action input", () => {
  it("accepts review progression without a reason", () => {
    expect(validateAdmissionStaffAction({ applicationId: 7, action: "start_review" })).toEqual({
      errors: [],
      value: { applicationId: 7, action: "start_review" }
    });
  });

  it("requires a meaningful reason for decisions", () => {
    const result = validateAdmissionStaffAction({
      applicationId: 7,
      action: "reject",
      reason: "short"
    });

    expect(result.errors).toContain("Decision reason must contain at least 8 characters.");
  });

  it("rejects invalid ids, actions and oversized notes", () => {
    const result = validateAdmissionStaffAction({
      applicationId: -1,
      action: "force_enroll",
      reason: "x".repeat(2001)
    });

    expect(result.errors).toContain("Application id is invalid.");
    expect(result.errors).toContain("Admission action is invalid.");
    expect(result.errors).toContain("Reason is too long.");
  });
});

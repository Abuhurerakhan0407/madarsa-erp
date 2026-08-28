import { describe, expect, it } from "vitest";
import { validateAdmissionConversionInput } from "./conversion-model";

describe("admission conversion input", () => {
  it("accepts the minimal conversion request", () => {
    expect(validateAdmissionConversionInput({ applicationId: 12 })).toEqual({
      value: { applicationId: 12, confirmNewPerson: false },
      errors: []
    });
  });

  it("accepts explicit duplicate confirmation", () => {
    expect(
      validateAdmissionConversionInput({ applicationId: 12, confirmNewPerson: true })
    ).toEqual({
      value: { applicationId: 12, confirmNewPerson: true },
      errors: []
    });
  });

  it("rejects invalid identifiers and unknown fields", () => {
    const result = validateAdmissionConversionInput({
      applicationId: 0,
      tenantId: 99
    });
    expect(result.value).toBeNull();
    expect(result.errors).toContain("A valid application id is required.");
    expect(result.errors).toContain("Conversion request contains unsupported fields.");
  });

  it("rejects non-boolean duplicate confirmation", () => {
    const result = validateAdmissionConversionInput({
      applicationId: 1,
      confirmNewPerson: "yes"
    });
    expect(result.value).toBeNull();
    expect(result.errors).toContain("Duplicate confirmation must be a boolean.");
  });
});

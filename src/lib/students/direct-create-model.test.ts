import { describe, expect, it } from "vitest";
import { validateDirectStudentCreateInput } from "./direct-create-model";

describe("validateDirectStudentCreateInput", () => {
  it("accepts a complete student payload", () => {
    const result = validateDirectStudentCreateInput({
      displayName: "Research Test Student",
      dateOfBirth: "2014-05-12",
      gender: "male",
      preferredLocale: "en",
      sessionId: 1,
      programId: 1,
      guardian: { name: "Research Test Guardian", relationship: "father", phone: "+910000000000" }
    });
    expect(result.errors).toEqual([]);
    expect(result.value?.displayName).toBe("Research Test Student");
  });

  it("rejects malformed identifiers and dates", () => {
    const result = validateDirectStudentCreateInput({
      displayName: "A",
      dateOfBirth: "12/05/2014",
      preferredLocale: "xx",
      sessionId: 0,
      programId: -1
    });
    expect(result.value).toBeUndefined();
    expect(result.errors.length).toBeGreaterThan(3);
  });
});

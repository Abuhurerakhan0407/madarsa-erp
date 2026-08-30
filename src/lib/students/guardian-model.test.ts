import { describe, expect, it } from "vitest";
import { validateStudentGuardianInput } from "./guardian-model";

describe("validateStudentGuardianInput", () => {
  it("accepts a governed primary guardian payload", () => {
    const result = validateStudentGuardianInput({
      name: "Demo Guardian",
      relationship: "father",
      phone: "+91 90000 00000",
      occupation: "Teacher",
      education: "Graduate",
      canCollect: true
    });
    expect(result.errors).toEqual([]);
    expect(result.value?.relationship).toBe("father");
    expect(result.value?.canCollect).toBe(true);
  });

  it("rejects invalid relationship and malformed fields", () => {
    const result = validateStudentGuardianInput({
      name: "A",
      relationship: "uncle",
      phone: "x".repeat(90),
      canCollect: "yes"
    });
    expect(result.value).toBeUndefined();
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

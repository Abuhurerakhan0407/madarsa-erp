import { describe, expect, it } from "vitest";
import { validateWalkInAdmissionInput } from "./walk-in-model";

const base = {
  displayName: "Ahmed Khan",
  preferredLocale: "en",
  sessionId: 1,
  programId: 1,
  groupId: 2,
  joinedOn: "2026-09-05",
  guardian: {
    name: "Yusuf Khan",
    relationship: "father",
    phone: "+919876543210"
  }
} as const;

describe("Client V3 walk-in admission input", () => {
  it("accepts date of birth with required guardian and placement", () => {
    const result = validateWalkInAdmissionInput({ ...base, dateOfBirth: "2015-04-03" });
    expect(result.errors).toEqual([]);
    expect(result.value?.displayName).toBe("Ahmed Khan");
    expect(result.value?.dateOfBirth).toBe("2015-04-03");
    expect(result.value?.groupId).toBe(2);
  });

  it("accepts reported age when date of birth is unknown", () => {
    const result = validateWalkInAdmissionInput({ ...base, ageYears: 11 });
    expect(result.errors).toEqual([]);
    expect(result.value?.dateOfBirth).toBeUndefined();
    expect(result.value?.ageYears).toBe(11);
  });

  it("requires either date of birth or reported age", () => {
    const result = validateWalkInAdmissionInput(base);
    expect(result.value).toBeUndefined();
    expect(result.errors).toContain("Date of birth or age is required.");
  });

  it("requires a class and primary guardian phone", () => {
    const result = validateWalkInAdmissionInput({
      ...base,
      dateOfBirth: "2015-04-03",
      groupId: undefined,
      guardian: { name: "Yusuf Khan", relationship: "father", phone: "" }
    });
    expect(result.value).toBeUndefined();
    expect(result.errors).toContain("Class/group is required.");
    expect(result.errors).toContain("Guardian phone is required.");
  });

  it("preserves controlled duplicate confirmation", () => {
    const result = validateWalkInAdmissionInput({ ...base, ageYears: 11, confirmNewPerson: true });
    expect(result.errors).toEqual([]);
    expect(result.value?.confirmNewPerson).toBe(true);
  });
});

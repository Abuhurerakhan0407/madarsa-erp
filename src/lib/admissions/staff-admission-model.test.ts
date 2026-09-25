import { describe, expect, it } from "vitest";
import {
  staffAdmissionApplicantData,
  validateStaffAdmissionInput
} from "./staff-admission-model";

const complete = {
  displayName: "Yusuf Ansari",
  nameNative: "یوسف انصاری",
  dateOfBirth: "2014-01-10",
  gender: "male",
  preferredLocale: "ur",
  sessionId: 1,
  programId: 1,
  groupId: 2,
  joinedOn: "2026-06-01",
  guardianName: "Khalid Ansari",
  guardianEmail: "guardian@example.com",
  guardianPhone: "+919999999999",
  guardianRelationship: "father"
} as const;

describe("staff admission validation", () => {
  it("allows an incomplete but academically scoped draft", () => {
    const result = validateStaffAdmissionInput({
      preferredLocale: "en",
      sessionId: 1,
      programId: 2,
      displayName: "Draft student"
    });
    expect(result.errors).toEqual([]);
    expect(result.value?.displayName).toBe("Draft student");
  });

  it("requires the complete student, guardian, class and joining fields at finalization", () => {
    const result = validateStaffAdmissionInput(
      { preferredLocale: "en", sessionId: 1, programId: 2 },
      { final: true }
    );
    expect(result.value).toBeUndefined();
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Class/group is required.",
        "Student name is required.",
        "Native student name is required.",
        "Joining date is required.",
        "Gender is required.",
        "Guardian name is required.",
        "Guardian email is required.",
        "Guardian relationship is required."
      ])
    );
  });

  it("accepts a complete final admission and normalizes guardian email", () => {
    const result = validateStaffAdmissionInput(
      { ...complete, guardianEmail: " Guardian@Example.COM " },
      { final: true }
    );
    expect(result.errors).toEqual([]);
    expect(result.value?.guardianEmail).toBe("guardian@example.com");
  });

  it("rejects invalid dates, email and photo tokens", () => {
    const result = validateStaffAdmissionInput({
      ...complete,
      dateOfBirth: "2026-02-31",
      guardianEmail: "not-an-email",
      photoToken: "short"
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Date of birth is invalid.",
        "Guardian email is invalid.",
        "Student photo token is invalid."
      ])
    );
  });

  it("maps normalized values to the established admission applicant-data keys", () => {
    const validated = validateStaffAdmissionInput(complete, { final: true });
    expect(validated.value).toBeDefined();
    expect(staffAdmissionApplicantData(validated.value!)).toMatchObject({
      applicant_name: "Yusuf Ansari",
      native_name: "یوسف انصاری",
      guardian_email: "guardian@example.com",
      guardian_relationship: "father",
      joining_date: "2026-06-01"
    });
  });
});

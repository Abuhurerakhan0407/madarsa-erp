import { describe, expect, it } from "vitest";
import {
  normalizePublicAdmissionLocale,
  validatePublicAdmissionSubmission,
  type PublicAdmissionSection
} from "./public-intake-model";

const sections: PublicAdmissionSection[] = [
  {
    key: "applicant",
    labels: { en: "Applicant", ur: "درخواست گزار", ar: "المتقدم" },
    fields: [
      {
        key: "applicant_name",
        type: "short_text",
        labels: { en: "Name", ur: "نام", ar: "الاسم" },
        required: true
      },
      {
        key: "guardian_email",
        type: "email",
        labels: { en: "Email", ur: "ای میل", ar: "البريد" }
      }
    ]
  }
];

describe("public admissions intake validation", () => {
  it("accepts only configured fields with required consent", () => {
    const result = validatePublicAdmissionSubmission(
      {
        sessionKey: "2026_27",
        programKey: "dars_e_nizami",
        preferredLocale: "ur",
        consent: true,
        answers: {
          applicant_name: "Amina",
          guardian_email: "guardian@example.com"
        }
      },
      sections
    );

    expect(result.errors).toEqual([]);
    expect(result.value?.preferredLocale).toBe("ur");
    expect(result.value?.answers.applicant_name).toBe("Amina");
  });

  it("rejects unknown fields, invalid email and missing required answers", () => {
    const result = validatePublicAdmissionSubmission(
      {
        sessionKey: "2026_27",
        programKey: "dars_e_nizami",
        preferredLocale: "en",
        consent: true,
        answers: {
          guardian_email: "not-an-email",
          injected: "payload"
        }
      },
      sections
    );

    expect(result.errors).toContain("Unknown form field: injected.");
    expect(result.errors).toContain("guardian_email has an invalid value.");
    expect(result.errors).toContain("applicant_name is required.");
  });

  it("rejects missing consent and unsupported language values", () => {
    const result = validatePublicAdmissionSubmission(
      {
        sessionKey: "2026_27",
        programKey: "dars_e_nizami",
        preferredLocale: "fr",
        consent: false,
        answers: { applicant_name: "Amina" }
      },
      sections
    );

    expect(result.errors).toContain("Preferred language is invalid.");
    expect(result.errors).toContain("Consent is required before submission.");
    expect(normalizePublicAdmissionLocale("fr")).toBe("en");
  });
});

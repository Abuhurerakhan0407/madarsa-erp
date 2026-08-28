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
      },
      {
        key: "date_of_birth",
        type: "date",
        labels: { en: "Date of birth", ur: "تاریخ پیدائش", ar: "تاريخ الميلاد" }
      }
    ]
  }
];

describe("public admissions intake validation", () => {
  function submitAnswers(answers: Record<string, string>) {
    return validatePublicAdmissionSubmission({
      sessionKey: "2026_27",
      programKey: "dars_e_nizami",
      preferredLocale: "en",
      consent: true,
      answers
    }, sections);
  }

  it.each(["2026-02-29", "2026-02-30", "2026-04-31", "0000-01-01"])(
    "rejects a date that cannot be stored during enrollment: %s",
    (date) => {
      const result = submitAnswers({ applicant_name: "Amina", date_of_birth: date });
      expect(result.value).toBeUndefined();
      expect(result.errors).toContain("date_of_birth has an invalid value.");
    }
  );

  it.each(["2024-02-29", "2026-04-30", ""])(
    "accepts a valid or omitted optional birth date: %s",
    (date) => {
      const result = submitAnswers({ applicant_name: "Amina", date_of_birth: date });
      expect(result.errors).toEqual([]);
      expect(result.value?.answers.date_of_birth).toBe(date);
    }
  );

  it.each(["A", "A".repeat(161)])("rejects names outside enrollment limits", (name) => {
    const result = submitAnswers({ applicant_name: name });
    expect(result.value).toBeUndefined();
    expect(result.errors).toContain("applicant_name must contain between 2 and 160 characters.");
  });

  it("accepts a trimmed applicant name at the enrollment limit", () => {
    const result = submitAnswers({ applicant_name: `  ${"A".repeat(160)}  ` });
    expect(result.errors).toEqual([]);
    expect(result.value?.answers.applicant_name).toHaveLength(160);
  });

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

import { describe, expect, it } from "vitest";
import { validatePublicAdmissionSubmission, type PublicAdmissionSection } from "./public-intake-model";

const sections: PublicAdmissionSection[] = [
  {
    key: "student",
    labels: { en: "Student", ur: "طالب علم", ar: "الطالب" },
    fields: [
      { key: "applicant_name", type: "short_text", labels: { en: "Name", ur: "نام", ar: "الاسم" }, required: true },
      { key: "native_name", type: "short_text", labels: { en: "Native name", ur: "مقامی نام", ar: "الاسم المحلي" }, required: true },
      { key: "date_of_birth", type: "date", labels: { en: "DOB", ur: "پیدائش", ar: "الميلاد" }, required: true },
      { key: "gender", type: "short_text", labels: { en: "Gender", ur: "جنس", ar: "الجنس" }, required: true }
    ]
  },
  {
    key: "guardian",
    labels: { en: "Guardian", ur: "سرپرست", ar: "ولي الأمر" },
    fields: [
      { key: "guardian_name", type: "short_text", labels: { en: "Guardian name", ur: "نام", ar: "الاسم" }, required: true },
      { key: "guardian_relationship", type: "short_text", labels: { en: "Relationship", ur: "رشتہ", ar: "صلة القرابة" }, required: true },
      { key: "guardian_phone", type: "phone", labels: { en: "Phone", ur: "فون", ar: "الهاتف" }, required: true },
      { key: "guardian_email", type: "email", labels: { en: "Email", ur: "ای میل", ar: "البريد" }, required: true }
    ]
  },
  {
    key: "placement",
    labels: { en: "Placement", ur: "تعیناتی", ar: "التسجيل" },
    fields: [
      { key: "group_key", type: "short_text", labels: { en: "Group", ur: "گروپ", ar: "المجموعة" }, required: true },
      { key: "joining_date", type: "date", labels: { en: "Joining", ur: "شمولیت", ar: "الالتحاق" }, required: true }
    ]
  }
];

function validAnswers() {
  return {
    applicant_name: "Amina Khan",
    native_name: "آمنہ خان",
    date_of_birth: "2015-05-20",
    gender: "female",
    guardian_name: "Yusuf Khan",
    guardian_relationship: "father",
    guardian_phone: "+91 9876543210",
    guardian_email: "guardian@example.com",
    group_key: "dars_year_1_a",
    joining_date: "2026-09-03"
  };
}

function validate(answers: Record<string, string>) {
  return validatePublicAdmissionSubmission({
    sessionKey: "2026_27",
    programKey: "dars_e_nizami",
    preferredLocale: "en",
    consent: true,
    answers
  }, sections);
}

describe("Client V2 public admission identity contract", () => {
  it("accepts the complete required identity and placement payload", () => {
    const result = validate(validAnswers());
    expect(result.errors).toEqual([]);
    expect(result.value?.answers.guardian_email).toBe("guardian@example.com");
  });

  it.each([
    ["gender", "unknown", "gender has an invalid value."],
    ["guardian_relationship", "uncle", "guardian_relationship has an invalid value."],
    ["group_key", "../../group", "group_key has an invalid value."]
  ])("rejects invalid %s", (key, value, expected) => {
    const answers = validAnswers();
    answers[key as keyof ReturnType<typeof validAnswers>] = value;
    const result = validate(answers);
    expect(result.value).toBeUndefined();
    expect(result.errors).toContain(expected);
  });

  it("requires guardian email in the Client V2 schema", () => {
    const answers = validAnswers();
    answers.guardian_email = "";
    const result = validate(answers);
    expect(result.errors).toContain("guardian_email is required.");
  });

  it("rejects identity names outside conversion limits", () => {
    const answers = validAnswers();
    answers.native_name = "A";
    const result = validate(answers);
    expect(result.errors).toContain("native_name must contain between 2 and 160 characters.");
  });
});

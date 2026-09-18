import { describe, expect, it } from "vitest";
import { configurationPresets, getConfigurationPreset } from "./presets";
import {
  assessConfigurationReadiness,
  publishedKeyChangeAllowed,
  renderNumberPreview,
  validateCustomFieldDraft,
  validateGradeScale,
  validateStatusMachine,
  validateTerminology
} from "./validators";

const labels = (en: string, ur: string, ar: string) => ({ en, ur, ar });

describe("configuration validation", () => {
  it("accepts governed multilingual custom fields", () => {
    expect(validateCustomFieldDraft({
      key: "previous_madrasa",
      entity: "student",
      type: "short_text",
      labels: labels("Previous madrasa", "سابقہ مدرسہ", "المدرسة السابقة"),
      required: false,
      validation: { minLength: 2, maxLength: 120 }
    })).toEqual({ valid: true, errors: [] });
  });

  it("rejects arbitrary execution primitives", () => {
    const validation = validateCustomFieldDraft({
      key: "unsafe_field",
      entity: "student",
      type: "calculated_display",
      labels: labels("Unsafe", "غیر محفوظ", "غير آمن"),
      required: false,
      validation: { script: "return tenant.data" }
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("validation.script uses a restricted primitive");
  });

  it("requires safe selection options", () => {
    const validation = validateCustomFieldDraft({
      key: "study_mode",
      entity: "student",
      type: "dropdown",
      labels: labels("Study mode", "مطالعہ طریقہ", "نمط الدراسة"),
      required: false,
      options: ["Day", "day"]
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("selection options must be unique");
  });

  it("accepts every locked institution preset", () => {
    expect(configurationPresets).toHaveLength(5);
    for (const preset of configurationPresets) {
      expect(validateTerminology(preset.terminology)).toEqual({ valid: true, errors: [] });
    }
  });

  it("keeps contrasting presets independent", () => {
    const hifz = getConfigurationPreset("hifz_academy");
    const school = getConfigurationPreset("islamic_school");

    expect(hifz.enabledDomains).toContain("hifz");
    expect(school.enabledDomains).toContain("academics");
    expect(hifz.terminology).not.toEqual(school.terminology);
  });

  it("detects ambiguous terminology", () => {
    const validation = validateTerminology([
      { conceptKey: "student", singular: labels("Learner", "طالب", "طالب"), plural: labels("Learners", "طلبہ", "طلاب") },
      { conceptKey: "teacher", singular: labels("Learner", "استاد", "معلم"), plural: labels("Teachers", "اساتذہ", "معلمون") }
    ]);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some((error) => error.includes("conflicts"))).toBe(true);
  });

  it("accepts deterministic acyclic status machines", () => {
    const validation = validateStatusMachine(
      [
        { key: "draft", labels: labels("Draft", "مسودہ", "مسودة") },
        { key: "submitted", labels: labels("Submitted", "جمع شدہ", "مُرسل") },
        { key: "approved", labels: labels("Approved", "منظور", "مقبول"), terminal: true, coreSemantic: true }
      ],
      [
        { from: "draft", to: "submitted", permission: "admissions.application.submit" },
        { from: "submitted", to: "approved", permission: "admissions.application.approve", requiresReason: true }
      ],
      "draft"
    );

    expect(validation).toEqual({ valid: true, errors: [] });
  });

  it("rejects circular status machines", () => {
    const validation = validateStatusMachine(
      [
        { key: "draft", labels: labels("Draft", "مسودہ", "مسودة") },
        { key: "review", labels: labels("Review", "جائزہ", "مراجعة") }
      ],
      [
        { from: "draft", to: "review", permission: "settings.configuration.manage" },
        { from: "review", to: "draft", permission: "settings.configuration.manage" }
      ],
      "draft"
    );

    expect(validation.errors).toContain("status transitions contain a cycle");
  });

  it("accepts complete grade coverage", () => {
    const validation = validateGradeScale([
      { key: "fail", minimum: 0, maximum: 40, label: labels("Fail", "ناکام", "راسب"), passing: false },
      { key: "pass", minimum: 40, maximum: 60, label: labels("Pass", "کامیاب", "ناجح"), passing: true },
      { key: "mumtaz", minimum: 60, maximum: 100, label: labels("Mumtaz", "ممتاز", "ممتاز"), passing: true }
    ]);

    expect(validation).toEqual({ valid: true, errors: [] });
  });

  it("rejects grade gaps", () => {
    const validation = validateGradeScale([
      { key: "fail", minimum: 0, maximum: 39, label: labels("Fail", "ناکام", "راسب"), passing: false },
      { key: "pass", minimum: 40, maximum: 100, label: labels("Pass", "کامیاب", "ناجح"), passing: true }
    ]);

    expect(validation.valid).toBe(false);
  });

  it("renders collision-reviewable number previews", () => {
    expect(renderNumberPreview({
      pattern: "{BRANCH}/{YEAR}/{TYPE}/{COUNTER}",
      padding: 5,
      nextValue: 42,
      branch: "MUM01",
      session: "2026-27",
      year: "2026",
      type: "ADM"
    })).toEqual({
      preview: "MUM01/2026/ADM/00042",
      validation: { valid: true, errors: [] }
    });
  });

  it("rejects unsafe number tokens", () => {
    const output = renderNumberPreview({
      pattern: "{TENANT}/{COUNTER}",
      padding: 4,
      nextValue: 1,
      branch: "MUM01",
      session: "2026-27",
      year: "2026",
      type: "STU"
    });

    expect(output.validation.valid).toBe(false);
  });

  it("computes onboarding readiness", () => {
    const readiness = assessConfigurationReadiness([
      { key: "institution", complete: true },
      { key: "branches", complete: true },
      { key: "languages", complete: false, blockers: ["Choose one primary language"] },
      { key: "calendar", complete: false }
    ]);

    expect(readiness.percent).toBe(50);
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toContain("Choose one primary language");
  });

  it("protects published stable keys", () => {
    expect(publishedKeyChangeAllowed("student_category", "student_type", true)).toBe(false);
    expect(publishedKeyChangeAllowed("student_category", "student_type", false)).toBe(true);
  });
});

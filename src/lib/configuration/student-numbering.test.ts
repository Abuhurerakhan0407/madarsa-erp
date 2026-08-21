import { describe, expect, it } from "vitest";
import { studentNumberPreview, validateStudentNumberingInput } from "./student-numbering";

describe("student numbering configuration", () => {
  it("accepts a branch and session-safe student sequence", () => {
    const result = validateStudentNumberingInput({
      pattern: "STU-{BRANCH}-{SESSION}-{SEQ}",
      startValue: 1,
      padding: 5,
      resetPeriod: "session"
    });

    expect(result.errors).toEqual([]);
    expect(result.value).toEqual({
      pattern: "STU-{BRANCH}-{SESSION}-{SEQ}",
      startValue: 1,
      padding: 5,
      resetPeriod: "session"
    });
    expect(studentNumberPreview(result.value!)).toBe("STU-MAIN-2026_27-00001");
  });

  it("requires reset dimensions to appear in the rendered number", () => {
    expect(validateStudentNumberingInput({
      pattern: "STU-{BRANCH}-{SEQ}",
      startValue: 1,
      padding: 5,
      resetPeriod: "session"
    }).errors).toContain("Session reset requires {SESSION} in the pattern.");

    expect(validateStudentNumberingInput({
      pattern: "STU-{BRANCH}-{SEQ}",
      startValue: 1,
      padding: 5,
      resetPeriod: "yearly"
    }).errors).toContain("Yearly reset requires {YYYY} or {YY} in the pattern.");
  });

  it("rejects patterns that can collide across branches or use unknown tokens", () => {
    const result = validateStudentNumberingInput({
      pattern: "STU-{CAMPUS}-{SEQ}",
      startValue: 1,
      padding: 5,
      resetPeriod: "never"
    });

    expect(result.errors).toContain("Unsupported number token: {CAMPUS}.");
    expect(result.errors).toContain("Branch-scoped student numbers must contain {BRANCH}.");
  });

  it("requires exactly one sequence token and bounded numeric settings", () => {
    const result = validateStudentNumberingInput({
      pattern: "STU-{BRANCH}-{SEQ}-{SEQ}",
      startValue: 0,
      padding: 13,
      resetPeriod: "never"
    });

    expect(result.errors).toContain("Number pattern must contain {SEQ} exactly once.");
    expect(result.errors).toContain("Starting value must be a positive safe integer.");
    expect(result.errors).toContain("Padding must be between 1 and 12 digits.");
  });
});

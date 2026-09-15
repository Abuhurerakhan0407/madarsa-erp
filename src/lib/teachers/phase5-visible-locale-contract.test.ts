import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Phase 5 teacher visible-locale contract", () => {
  it("does not fall back to English labels inside the Urdu teacher workspace", () => {
    const source = read("src/components/teachers-workspace.tsx");
    expect(source).toContain('if (locale === "ur") return labels.ur || fallback;');
    expect(source).toContain("return labels.en || fallback;");
    expect(source).not.toContain("labels[locale] || labels.en || labels.ur || labels.ar || fallback");
  });

  it("keeps known teacher designations localized in Urdu", () => {
    const source = read("src/components/teachers-workspace.tsx");
    expect(source).toContain('teacher: "استاد"');
    expect(source).toContain('assistant_teacher: "معاون استاد"');
    expect(source).toContain('attendance_supervisor: "حاضری نگران"');
    expect(source).toContain('dars_e_nizami_teacher: "درسِ نظامی استاد"');
    expect(source).toContain('admissions_coordinator: "داخلہ رابطہ کار"');
    expect(source).toContain('hifz_instructor: "حفظ استاد"');
    expect(source).toContain('exam_evaluator: "امتحانی ممتحن"');
  });
});

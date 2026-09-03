import { describe, expect, it } from "vitest";
import { validateQuranDailyQuickInput, validateQuranDailyTarget } from "./daily-register-model";

const base = {
  requestKey: "quran-daily-1234567890",
  groupId: 2,
  sessionDate: "2026-09-03",
  personId: 4,
  workCategory: "sabaq",
  action: "pass",
  mistakeCount: 0
};

describe("validateQuranDailyTarget", () => {
  it("accepts Juz, Ayah and Mushaf page targets", () => {
    expect(validateQuranDailyTarget({ mode: "juz", juz_number: 30 }).error).toBeUndefined();
    expect(validateQuranDailyTarget({ mode: "ayah", start_surah_number: 2, start_ayah_number: 1, end_surah_number: 2, end_ayah_number: 5 }).error).toBeUndefined();
    expect(validateQuranDailyTarget({ mode: "page", page_start: 10, page_end: 12 }).error).toBeUndefined();
  });

  it("rejects invalid ranges", () => {
    expect(validateQuranDailyTarget({ mode: "juz", juz_number: 31 }).error).toContain("between 1 and 30");
    expect(validateQuranDailyTarget({ mode: "ayah", start_surah_number: 3, start_ayah_number: 10, end_surah_number: 3, end_ayah_number: 2 }).error).toContain("Valid Surah and Ayah");
    expect(validateQuranDailyTarget({ mode: "page", page_start: 605, page_end: 606 }).error).toContain("between 1 and 604");
  });
});

describe("validateQuranDailyQuickInput", () => {
  it("accepts a detailed pass with next target", () => {
    const result = validateQuranDailyQuickInput({
      ...base,
      target: { mode: "juz", juz_number: 30 },
      qualityScore: 88,
      tajweedScore: 84,
      fluencyScore: 90,
      mistakeCount: 2,
      teacherNote: "Strong retention today.",
      nextTarget: { mode: "juz", juz_number: 29, work_category: "sabqi" },
      revisionDueOn: "2026-09-05"
    });
    expect(result.errors).toEqual([]);
    expect(result.value?.nextTarget?.work_category).toBe("sabqi");
  });

  it("allows absent and no-lesson statuses without inventing a recitation target", () => {
    for (const action of ["absent", "no_lesson"] as const) {
      const result = validateQuranDailyQuickInput({ ...base, action });
      expect(result.errors).toEqual([]);
      expect(result.value?.target).toBeUndefined();
    }
  });

  it("rejects unsupported fields and invalid scores", () => {
    const result = validateQuranDailyQuickInput({ ...base, qualityScore: 101, injectedTenantId: 999 });
    expect(result.errors.join(" ")).toContain("unsupported fields");
    expect(result.errors.join(" ")).toContain("Quality score");
  });

  it("rejects impossible dates and revision dates before the lesson", () => {
    expect(validateQuranDailyQuickInput({ ...base, sessionDate: "2026-02-30" }).errors.join(" ")).toContain("Valid lesson date");
    expect(validateQuranDailyQuickInput({ ...base, revisionDueOn: "2026-09-02" }).errors.join(" ")).toContain("cannot be before");
  });

  it("rejects malformed next targets", () => {
    const result = validateQuranDailyQuickInput({
      ...base,
      target: { mode: "juz", juz_number: 1 },
      nextTarget: { mode: "juz", juz_number: 1, work_category: "made_up" }
    });
    expect(result.errors.join(" ")).toContain("Next target work category is invalid");
  });
});

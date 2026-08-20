import { describe, expect, it } from "vitest";
import type { RecitationAttempt } from "./model";
import { canAdvanceReadingUnit, explainStrength, repeatedMistakes, validatePortion } from "./rules";

const attempt: RecitationAttempt = {
  id: "attempt-1",
  studentPersonId: "student-1",
  occurredAt: "2026-08-20T08:00:00.000Z",
  portion: { start: { surah: 2, ayah: 1 }, end: { surah: 2, ayah: 5 }, editionKey: "indo_pak" },
  workCategory: "sabaq",
  accuracy: 80,
  fluency: 75,
  tajweed: 70,
  prompts: 1,
  outcome: "partial",
  mistakes: [{ category: "tajweed", reference: { surah: 2, ayah: 3 }, severity: 3 }]
};

describe("learning rules", () => {
  it("rejects reversed Quran portions", () => {
    expect(validatePortion({ start: { surah: 2, ayah: 5 }, end: { surah: 2, ayah: 1 }, editionKey: "indo_pak" })).toContain("portion_reversed");
  });

  it("derives repeated mistakes without AI", () => {
    expect(repeatedMistakes([attempt, { ...attempt, id: "attempt-2" }], 30, new Date("2026-08-21T00:00:00.000Z"))).toEqual([
      expect.objectContaining({ key: "tajweed:200300", count: 2 })
    ]);
  });

  it("explains every strength state", () => {
    const result = explainStrength([attempt], 20, 3);
    expect(result.factors).toEqual(expect.arrayContaining(["severe_mistakes:1", "overdue_days:3"]));
    expect(result.score).toBeLessThan(80);
  });

  it("requires reading prerequisites", () => {
    expect(canAdvanceReadingUnit(new Set(["unit-1"]), { id: "unit-2", sequence: 2, prerequisiteUnitIds: ["unit-1"] })).toBe(true);
    expect(canAdvanceReadingUnit(new Set(), { id: "unit-2", sequence: 2, prerequisiteUnitIds: ["unit-1"] })).toBe(false);
  });
});

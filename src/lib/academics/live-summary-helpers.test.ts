import { describe, expect, it } from "vitest";
import { buildProgramSummary } from "./live-summary-helpers";

describe("academic program summary", () => {
  it("counts active group rows and unique students by program", () => {
    const result = buildProgramSummary(
      [
        { id: 1, key: "hifz", labels: { en: "Hifz", ur: "حفظ" } },
        { id: 2, key: "nazra", labels: { en: "Nazra" } }
      ],
      [{ program_id: 1 }, { program_id: 1 }, { program_id: 2 }],
      [
        { program_id: 1, student_person_id: 10 },
        { program_id: 1, student_person_id: 10 },
        { program_id: 1, student_person_id: 11 },
        { program_id: 2, student_person_id: 12 }
      ],
      "en"
    );

    expect(result).toEqual([
      { id: 1, key: "hifz", label: "Hifz", groups: 2, students: 2 },
      { id: 2, key: "nazra", label: "Nazra", groups: 1, students: 1 }
    ]);
  });

  it("uses configured locale labels with a stable fallback", () => {
    const result = buildProgramSummary(
      [
        { id: 1, key: "hifz", labels: { ur: "حفظ", en: "Hifz" } },
        { id: 2, key: "custom_program", labels: { ar: "برنامج" } }
      ],
      [],
      [],
      "ur"
    );

    expect(result[0].label).toBe("حفظ");
    expect(result[1].label).toBe("برنامج");
  });
});

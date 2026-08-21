import { describe, expect, it } from "vitest";
import { aggregateProgramAttendance, dateKeyInTimeZone } from "./summary";

describe("dashboard summary helpers", () => {
  it("uses the institution timezone for the local date", () => {
    const date = new Date("2026-08-20T20:30:00.000Z");
    expect(dateKeyInTimeZone(date, "Asia/Kolkata")).toBe("2026-08-21");
  });

  it("aggregates attendance by program using enrollment links", () => {
    const result = aggregateProgramAttendance(
      [
        { id: 10, key: "hifz", labels: { en: "Hifz", ur: "حفظ" } },
        { id: 20, key: "nazra", labels: { en: "Nazra" } }
      ],
      [
        { enrollment_id: 1, presence_ratio: 1 },
        { enrollment_id: 2, presence_ratio: 0.5 },
        { enrollment_id: 3, presence_ratio: 0 }
      ],
      [
        { id: 1, program_id: 10 },
        { id: 2, program_id: 10 },
        { id: 3, program_id: 20 }
      ],
      "en"
    );

    expect(result).toEqual([
      { id: 10, key: "hifz", label: "Hifz", value: 75 },
      { id: 20, key: "nazra", label: "Nazra", value: 0 }
    ]);
  });

  it("falls back to a stable label when a locale label is missing", () => {
    const [program] = aggregateProgramAttendance(
      [{ id: 10, key: "custom-program", labels: { ar: "برنامج" } }],
      [],
      [],
      "ur"
    );

    expect(program.label).toBe("برنامج");
    expect(program.value).toBe(0);
  });
});

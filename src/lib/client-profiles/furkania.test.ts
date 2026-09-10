import { describe, expect, it } from "vitest";

import { furkaniaProfile } from "./furkania";
import { getFurkaniaReadiness } from "./furkania-readiness";

describe("Madrasa-e-Furkania client profile", () => {
  it("keeps confirmed client facts stable", () => {
    expect(furkaniaProfile.displayName).toBe("Madrasa-e-Furkania");
    expect(furkaniaProfile.students.currentCount).toBe(180);
    expect(furkaniaProfile.students.approximateAgeRange).toEqual({ min: 4, max: 18 });
    expect(furkaniaProfile.curriculum.family).toBe("deeniyat");
    expect(furkaniaProfile.curriculum.courses).toEqual([1, 2, 3, 4, 5]);
    expect(furkaniaProfile.scheduling.shifts).toEqual(["morning", "midday", "evening"]);
  });

  it("uses the five Deeniyat subject families", () => {
    expect(furkaniaProfile.curriculum.subjectGroups).toEqual([
      "quraan",
      "hadeeth",
      "aqaaid_and_masaail",
      "islamic_upbringing",
      "language",
    ]);
  });

  it("does not invent unconfirmed timetable or operational rules", () => {
    expect(furkaniaProfile.scheduling.exactShiftTimes).toBeNull();
    expect(furkaniaProfile.scheduling.operatingDays).toBeNull();
    expect(furkaniaProfile.staff.exactTeacherCount).toBeNull();
    expect(furkaniaProfile.attendance.studentMethod).toBeNull();
    expect(furkaniaProfile.academics.examCadence).toBeNull();
    expect(furkaniaProfile.fees.structure).toBeNull();
  });

  it("allows core setup before exact shift times are known", () => {
    const readiness = getFurkaniaReadiness();

    expect(readiness.readyForCoreSetup).toBe(true);
    expect(readiness.readyForTimetableActivation).toBe(false);
  });
});

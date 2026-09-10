import { describe, expect, it } from "vitest";

import {
  furkaniaDeeniyatLevels,
  furkaniaDeeniyatProgram,
  furkaniaDeeniyatSubjects,
  furkaniaShiftKeys
} from "./furkania-deeniyat";

describe("Madrasa-e-Furkania Deeniyat bootstrap", () => {
  it("uses an isolated custom program instead of the generic Deeniyat seed", () => {
    expect(furkaniaDeeniyatProgram.key).toBe("deeniyat_primary");
    expect(furkaniaDeeniyatProgram.programType).toBe("custom");
    expect(furkaniaDeeniyatProgram.templateKey).toBe("blank_custom");
  });

  it("locks the confirmed Hinglish book medium and young-student entry rule", () => {
    expect(furkaniaDeeniyatProgram.bookMedium).toBe("hinglish");
    expect(furkaniaDeeniyatProgram.entryRules.age4To5Course).toBe(1);
  });

  it("defines Course 1 through Course 5", () => {
    expect(furkaniaDeeniyatLevels.map((level) => level.key)).toEqual([
      "course_1",
      "course_2",
      "course_3",
      "course_4",
      "course_5"
    ]);
  });

  it("defines the five confirmed Deeniyat subject families", () => {
    expect(furkaniaDeeniyatSubjects.map((subject) => subject.key)).toEqual([
      "quraan",
      "hadeeth",
      "aqaaid_and_masaail",
      "islamic_upbringing",
      "language"
    ]);
  });

  it("keeps shifts as labels only until exact times are confirmed", () => {
    expect(furkaniaShiftKeys).toEqual(["morning", "midday", "evening"]);
  });
});

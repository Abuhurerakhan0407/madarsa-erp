import { describe, expect, it } from "vitest";
import { getConfigurationPreset } from "./presets";
import { buildPresetDraftPayload } from "./preset-payload";

describe("configuration preset draft payload", () => {
  it("expands every terminology concept into release locales only", () => {
    const payload = buildPresetDraftPayload(getConfigurationPreset("maktab"));
    expect(payload.terminology).toHaveLength(6);
    expect(payload.terminology.filter((row) => row.concept_key === "student")).toHaveLength(2);
    expect(new Set(payload.terminology.map((row) => row.locale))).toEqual(new Set(["en", "ur"]));
  });

  it("maps attendance preset keys to explicit semantics", () => {
    const payload = buildPresetDraftPayload(getConfigurationPreset("hifz_academy"));
    expect(payload.attendanceStatuses).toContainEqual({
      key: "absent",
      category: "absent",
      presenceRatio: 0,
      triggersAlert: true
    });
    expect(payload.attendanceStatuses).toContainEqual({
      key: "late",
      category: "late",
      presenceRatio: 1,
      triggersAlert: false
    });
  });
});

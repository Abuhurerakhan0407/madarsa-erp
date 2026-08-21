import { describe, expect, it } from "vitest";
import { getConfigurationPreset } from "./presets";
import { buildPresetDraftPayload } from "./preset-payload";

describe("configuration preset draft payload", () => {
  it("expands every terminology concept into all supported locales", () => {
    const payload = buildPresetDraftPayload(getConfigurationPreset("maktab"));
    expect(payload.terminology).toHaveLength(9);
    expect(payload.terminology.filter((row) => row.concept_key === "student")).toHaveLength(3);
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

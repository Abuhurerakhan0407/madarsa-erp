import { describe, expect, it } from "vitest";
import { readinessPercent, versionedConfigurationState } from "./readiness-helpers";

describe("configuration readiness", () => {
  it("treats a published version as complete", () => {
    expect(versionedConfigurationState([{ status: "draft" }, { status: "published" }])).toBe("complete");
  });

  it("treats existing unpublished configuration as attention", () => {
    expect(versionedConfigurationState([{ state: "validated" }])).toBe("attention");
    expect(versionedConfigurationState([])).toBe("pending");
  });

  it("scores attention at half weight", () => {
    expect(readinessPercent(["complete", "attention", "pending", "complete"])).toBe(63);
  });
});

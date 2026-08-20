import { describe, expect, it } from "vitest";
import { resolveConfigurationValue } from "./resolution";

describe("configuration hierarchy resolution", () => {
  const at = new Date("2026-08-20T12:00:00.000Z");

  it("uses platform defaults without overrides", () => {
    expect(resolveConfigurationValue({
      platformDefault: "en",
      values: [],
      context: { tenant: "tenant-1" },
      at
    })).toEqual({ value: "en", source: "platform" });
  });

  it("uses editable preset values before tenant overrides", () => {
    expect(resolveConfigurationValue({
      platformDefault: "en",
      presetValue: "ur",
      values: [],
      context: { tenant: "tenant-1" },
      at
    })).toEqual({ value: "ur", source: "preset" });
  });

  it("applies tenant then approved branch and program overrides", () => {
    const resolved = resolveConfigurationValue({
      platformDefault: 3,
      presetValue: 4,
      values: [
        { scope: "tenant", scopeKey: "tenant-1", value: 5, version: 1, effectiveAt: "2026-01-01T00:00:00.000Z" },
        { scope: "branch", scopeKey: "branch-1", value: 2, version: 1, effectiveAt: "2026-02-01T00:00:00.000Z" },
        { scope: "program", scopeKey: "hifz", value: 1, version: 2, effectiveAt: "2026-03-01T00:00:00.000Z" }
      ],
      context: { tenant: "tenant-1", branch: "branch-1", program: "hifz" },
      at
    });

    expect(resolved).toEqual({ value: 1, source: "program", version: 2 });
  });

  it("ignores future, expired, and foreign-scope values", () => {
    const resolved = resolveConfigurationValue({
      platformDefault: "platform",
      presetValue: "preset",
      values: [
        { scope: "tenant", scopeKey: "tenant-2", value: "foreign", version: 1, effectiveAt: "2026-01-01T00:00:00.000Z" },
        { scope: "tenant", scopeKey: "tenant-1", value: "expired", version: 2, effectiveAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-08-01T00:00:00.000Z" },
        { scope: "tenant", scopeKey: "tenant-1", value: "future", version: 3, effectiveAt: "2026-09-01T00:00:00.000Z" }
      ],
      context: { tenant: "tenant-1" },
      at
    });

    expect(resolved).toEqual({ value: "preset", source: "preset" });
  });

  it("uses latest effective version within one scope", () => {
    const resolved = resolveConfigurationValue({
      platformDefault: "en",
      values: [
        { scope: "tenant", scopeKey: "tenant-1", value: "en", version: 1, effectiveAt: "2026-01-01T00:00:00.000Z" },
        { scope: "tenant", scopeKey: "tenant-1", value: "ur", version: 2, effectiveAt: "2026-04-01T00:00:00.000Z" }
      ],
      context: { tenant: "tenant-1" },
      at
    });

    expect(resolved).toEqual({ value: "ur", source: "tenant", version: 2 });
  });
});

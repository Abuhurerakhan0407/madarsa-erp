import { describe, expect, it } from "vitest";
import { resolveOperatorAppDestination } from "./app-entry-destination";

describe("operator app entry destination", () => {
  it("falls back to the current locale workspace when no prior route exists", () => {
    expect(resolveOperatorAppDestination(null, "en")).toBe("/en");
    expect(resolveOperatorAppDestination(undefined, "ur")).toBe("/ur");
  });

  it("restores an encoded workspace route and preserves query/hash", () => {
    const stored = encodeURIComponent("/en/attendance?date=2026-09-25#register");
    expect(resolveOperatorAppDestination(stored, "en")).toBe(
      "/en/attendance?date=2026-09-25#register"
    );
  });

  it("localizes the restored route to the user's current language", () => {
    expect(
      resolveOperatorAppDestination(
        encodeURIComponent("/en/students?page=2"),
        "ur"
      )
    ).toBe("/ur/students?page=2");
  });

  it("rejects non-workspace, external and malformed destinations", () => {
    for (const value of [
      encodeURIComponent("/login"),
      encodeURIComponent("/portal"),
      encodeURIComponent("//evil.example/path"),
      encodeURIComponent("https://evil.example/en"),
      "%E0%A4%A"
    ]) {
      expect(resolveOperatorAppDestination(value, "ur")).toBe("/ur");
    }
  });
});

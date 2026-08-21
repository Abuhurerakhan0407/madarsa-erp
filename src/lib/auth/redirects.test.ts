import { describe, expect, it } from "vitest";
import { safeAuthRedirect } from "./redirects";

describe("safeAuthRedirect", () => {
  it("accepts application-relative paths", () => {
    expect(safeAuthRedirect("/ur/students?tab=active")).toBe("/ur/students?tab=active");
  });

  it.each([
    null,
    "https://attacker.example",
    "//attacker.example/path",
    "/\\attacker.example/path",
    "javascript:alert(1)"
  ])("rejects unsafe redirect value %s", (value) => {
    expect(safeAuthRedirect(value)).toBe("/en");
  });
});

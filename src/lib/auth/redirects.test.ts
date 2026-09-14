import { describe, expect, it } from "vitest";
import { authLocaleFromRedirect, localizeAuthDestination, safeAuthRedirect } from "./redirects";

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

  it("allows a controlled localized fallback without weakening redirect validation", () => {
    expect(safeAuthRedirect(null, "/ur")).toBe("/ur");
    expect(safeAuthRedirect(null, "https://attacker.example")).toBe("/en");
  });

  it("derives the auth locale from localized routes and query-localized auth surfaces", () => {
    expect(authLocaleFromRedirect("/ur/students")).toBe("ur");
    expect(authLocaleFromRedirect("/portal?tenant=4&locale=ur")).toBe("ur");
    expect(authLocaleFromRedirect("/en/students")).toBe("en");
  });

  it("applies the selected locale only to governed localized/auth destinations", () => {
    expect(localizeAuthDestination("/en/students?tab=active", "ur")).toBe("/ur/students?tab=active");
    expect(localizeAuthDestination("/onboarding", "ur")).toBe("/onboarding?locale=ur");
    expect(localizeAuthDestination("/portal?tenant=4", "ur")).toBe("/portal?tenant=4&locale=ur");
    expect(localizeAuthDestination("https://attacker.example", "ur")).toBe("/ur");
  });
});

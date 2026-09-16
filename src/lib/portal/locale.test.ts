import { describe, expect, it } from "vitest";
import { formatPortalDateTime, localizedPortalText, portalHref, preservePortalLocale, resolvePortalLocale } from "./locale";

describe("portal locale helpers", () => {
  it("exposes only English or Urdu portal locale choices", () => {
    expect(resolvePortalLocale("ur")).toBe("ur");
    expect(resolvePortalLocale("en")).toBe("en");
    expect(resolvePortalLocale("ar")).toBe("en");
    expect(resolvePortalLocale(undefined)).toBe("en");
  });

  it("prefers the requested localized value while preserving authored English fallback", () => {
    expect(localizedPortalText({ en: "Notice", ur: "اطلاع", ar: "إشعار" }, "ur")).toBe("اطلاع");
    expect(localizedPortalText({ en: "Institution-authored notice" }, "ur", "—")).toBe("Institution-authored notice");
    expect(localizedPortalText({ ar: "إشعار" }, "ur", "—")).toBe("—");
  });

  it("preserves portal locale and existing query values", () => {
    expect(portalHref("/portal?tenant=7", "ur")).toBe("/portal?tenant=7&locale=ur");
    expect(portalHref("/portal/claim", "en", { code: "MDR-ABC", tenant: 7 })).toBe("/portal/claim?locale=en&code=MDR-ABC&tenant=7");
    expect(preservePortalLocale("/portal/change-password?tenant=7", "ur")).toBe("/portal/change-password?tenant=7&locale=ur");
    expect(preservePortalLocale("/en/students", "ur")).toBe("/en/students");
  });

  it("formats valid dates and safely rejects invalid values", () => {
    expect(formatPortalDateTime("not-a-date", "en")).toBe("—");
    expect(formatPortalDateTime(null, "ur")).toBe("—");
    expect(formatPortalDateTime("2026-09-14T12:00:00.000Z", "en")).not.toBe("—");
  });
});

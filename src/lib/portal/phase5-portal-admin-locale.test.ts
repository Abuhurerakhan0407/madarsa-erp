import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Phase 5 portal administration locale contract", () => {
  it("passes the routed English or Urdu locale into the portal administration center", () => {
    const page = read("src/app/[locale]/portals/page.tsx");
    expect(page).toContain('rawLocale === "ur" ? "ur" : "en"');
    expect(page).toContain("getDirection(locale)");
    expect(page).toContain("locale={locale}");
    expect(page).toContain("والدین اور اساتذہ کی رسائی");
  });

  it("localizes account states, actions, errors, dates and claim links", () => {
    const center = read("src/components/portal-admin-center.tsx");
    expect(center).toContain("locale: SupportedLocale");
    expect(center).toContain("scopeLabel(candidate, locale)");
    expect(center).toContain("statusLabel(candidate.accountStatus, locale)");
    expect(center).toContain("formatPortalDateTime(candidate.lastLogin, locale)");
    expect(center).toContain("formatPortalDate(item.expiresAt, locale)");
    expect(center).toContain("preservePortalLocale(issued.claimPath, locale)");
    expect(center).toContain("پورٹل اکاؤنٹس");
    expect(center).toContain("پورٹل اسناد منظم نہیں ہو سکیں");
    expect(center).not.toContain("text(labels.ar)");
  });

  it("keeps every mutating portal-admin action visibly pending", () => {
    const center = read("src/components/portal-admin-center.tsx");
    expect(center).toContain("aria-busy={busy === provisionKey || undefined}");
    expect(center).toContain("aria-busy={busy === resetKey || undefined}");
    expect(center).toContain("aria-busy={busy === accessKey || undefined}");
    expect(center).toContain("aria-busy={busy === issueKey || undefined}");
    expect(center).toContain('aria-busy={busy === "notice" || undefined}');
  });
});

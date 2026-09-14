import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Phase 5 portal English and Urdu contract", () => {
  it("keeps portal navigation and authored notice content locale-aware", () => {
    const page = read("src/app/portal/page.tsx");
    expect(page).toContain("resolvePortalLocale");
    expect(page).toContain("localizedPortalText(notice.labels, locale");
    expect(page).toContain("localizedPortalText(notice.body, locale");
    expect(page).toContain('locale={locale}');
    expect(page).toContain("portalHref");
    expect(page).not.toContain("object(notice.labels).en");
    expect(page).not.toContain("object(notice.body).en");
  });

  it("localizes the full parent priority, attendance and notification surfaces", () => {
    const priority = read("src/components/portal-parent-priority-overview.tsx");
    const attendance = read("src/components/portal-attendance-v2-section.tsx");
    const notifications = read("src/components/portal-notification-center.tsx");
    expect(priority).toContain("locale: SupportedLocale");
    expect(priority).toContain("localizedPortalText");
    expect(attendance).toContain("locale: SupportedLocale");
    expect(attendance).toContain("Emergency manual");
    expect(attendance).toContain("ہنگامی دستی اندراج");
    expect(notifications).toContain("locale: SupportedLocale");
    expect(notifications).toContain("localizedPortalText(item.title, locale");
    expect(notifications).toContain("markReadError");
    expect(notifications).not.toContain('for (const key of ["en", "ur", "ar"])');
  });

  it("preserves locale through claim, password change and sign out", () => {
    const claimPage = read("src/app/portal/claim/page.tsx");
    const claimForm = read("src/components/portal-claim-form.tsx");
    const passwordPage = read("src/app/portal/change-password/page.tsx");
    const passwordForm = read("src/components/portal-password-change-form.tsx");
    const signOut = read("src/components/sign-out-button.tsx");
    expect(claimPage).toContain("resolvePortalLocale");
    expect(claimForm).toContain("portalHref");
    expect(passwordPage).toContain("resolvePortalLocale");
    expect(passwordForm).toContain("portalHref");
    expect(signOut).toContain("afterSignOut");
    expect(signOut).toContain("router.push(afterSignOut)");
  });

  it("loads multilingual font variables and final Urdu polish on auth-adjacent layouts", () => {
    for (const path of ["src/app/login/layout.tsx", "src/app/onboarding/layout.tsx", "src/app/portal/layout.tsx"]) {
      const layout = read(path);
      expect(layout).toContain("appFontVariables");
      expect(layout).toContain("phase5-polish.css");
    }
  });
});

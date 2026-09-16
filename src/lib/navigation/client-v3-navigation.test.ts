import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyNavigationAudience } from "./audience-classifier";
import { getClientV3Navigation, getSupplementalMobileNavigation } from "./client-v3-navigation";

const deferredSurfacePattern = /demo|fees|payment|donation|hostel|transport|library|whatsapp|ai/i;

function allItems(audience: "office" | "teacher") {
  const navigation = getClientV3Navigation(audience);
  return [...navigation.primary, ...navigation.more];
}

function routePageFor(href: string) {
  const localizedPath = href.replace(/^\/(en|ur)/, "");
  return `src/app/[locale]${localizedPath}/page.tsx`.replace("[locale]//", "[locale]/");
}

describe("Client V3 navigation", () => {
  it("uses release-safe office IA without deferred modules", () => {
    const nav = getClientV3Navigation("office");
    expect(nav.primary.map((item) => item.key)).toEqual(["home", "admissions", "students", "attendance", "quran"]);
    expect(nav.more.map((item) => item.key)).toEqual(["portals", "teachers", "exams", "documents", "reports", "settings"]);
    expect(nav.mobile.map((item) => item.key)).toEqual(["home", "admissions", "students", "attendance"]);
    expect(allItems("office").map((item) => item.href("en")).join(" ")).not.toMatch(deferredSurfacePattern);
  });

  it("uses a teacher-specific primary surface", () => {
    const nav = getClientV3Navigation("teacher");
    expect(nav.primary.map((item) => item.key)).toEqual(["home", "my-students", "attendance", "quran"]);
    expect(nav.mobile.map((item) => item.key)).toEqual(["home", "my-students", "attendance", "quran"]);
    expect(getSupplementalMobileNavigation(nav)).toEqual([]);
  });

  it("keeps office mobile navigation to five tabs including the menu", () => {
    const nav = getClientV3Navigation("office");
    const supplemental = getSupplementalMobileNavigation(nav);
    expect(nav.mobile).toHaveLength(4);
    expect(supplemental.map((item) => item.key)).toEqual(["quran", "portals", "teachers", "exams", "documents", "reports", "settings"]);
    expect(nav.mobile.length + 1).toBeLessThanOrEqual(5);
  });

  it("points every authenticated navigation item at a concrete page with no literal route placeholders", () => {
    for (const audience of ["office", "teacher"] as const) {
      for (const item of allItems(audience)) {
        for (const locale of ["en", "ur"] as const) {
          const href = item.href(locale);
          expect(href).not.toMatch(/[\[\]]/);
          expect(href.startsWith(`/${locale}`)).toBe(true);
          expect(existsSync(routePageFor(href)), `${audience}:${item.key} -> ${href}`).toBe(true);
        }
      }
    }
  });

  it("classifies teaching-only memberships as teacher", () => {
    expect(classifyNavigationAudience(["teacher"], ["students.profile.read", "attendance.student.read", "attendance.student.mark", "learning.progress.read"])).toBe("teacher");
  });

  it("fails ambiguous or office-capable memberships to office", () => {
    expect(classifyNavigationAudience(["teacher"], ["students.profile.read", "attendance.student.mark", "settings.configuration.read"])).toBe("office");
    expect(classifyNavigationAudience([], [])).toBe("office");
  });
});
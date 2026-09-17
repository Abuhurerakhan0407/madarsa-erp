import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
const nav = root("src/lib/navigation/app-navigation.ts");
const scope = root("docs/commercial-release-scope.md");
const i18n = root("src/lib/i18n/config.ts");

describe("commercial release scope lock", () => {
  it("keeps removed modules out of client navigation", () => {
    for (const key of ["hostel", "transport", "library", "whatsapp"])
      expect(nav).not.toContain(`key: \"${key}\"`);
  });

  it("keeps required launch surfaces in client navigation", () => {
    for (const key of ["admissions", "students", "programs", "academics", "attendance", "quran", "exams", "portals", "staff", "payroll", "fees", "donations", "certificates", "reports", "configuration", "branches", "ai"])
      expect(nav).toContain(`key: \"${key}\"`);
  });

  it("does not claim a student portal", () => {
    expect(scope).toContain("Student Portal");
    expect(scope).toContain("Explicitly removed");
    expect(nav.toLowerCase()).not.toContain("student portal");
  });

  it("locks route locale selection to English and Urdu", () => {
    expect(i18n).toContain('export const locales = ["en", "ur"] as const');
  });
});

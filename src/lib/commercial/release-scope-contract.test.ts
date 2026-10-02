import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
const nav = root("src/lib/navigation/client-v3-navigation.ts");
const scope = root("docs/commercial-release-scope.md");
const i18n = root("src/lib/i18n/config.ts");
const portalAdmin = root("src/components/portal-admin-center.tsx");
const credentialRoute = root("src/app/api/portals/credentials/route.ts");
const conversionRoute = root("src/app/api/admissions/convert/route.ts");
const claimMigration = root("supabase/migrations/20260916124501_phase5_claim_only_portal_lifecycle.sql");

describe("commercial release scope lock", () => {
  it("keeps removed modules out of runtime Client V3 navigation", () => {
    for (const value of ["hostel", "transport", "library", "whatsapp", "student portal"])
      expect(nav.toLowerCase()).not.toContain(value);
  });

  it("keeps required launch surfaces in runtime Client V3 navigation", () => {
    for (const key of [
      "admissions", "students", "programs", "academics", "lifecycle", "attendance",
      "quran", "exams", "portals", "teachers", "payroll", "fees", "contributions",
      "documents", "reports", "settings", "access", "assistant"
    ]) expect(nav).toContain(`item("${key}"`);
  });

  it("does not claim a student portal", () => {
    expect(scope).toContain("Student Portal");
    expect(scope).toContain("Explicitly removed");
    expect(nav.toLowerCase()).not.toContain("student portal");
  });

  it("locks route locale selection to English and Urdu", () => {
    expect(i18n).toContain('export const locales = ["en", "ur"] as const');
  });

  it("keeps portal lifecycle claim-only", () => {
    expect(credentialRoute).toContain("PORTAL_CREDENTIALS_RETIRED");
    expect(credentialRoute).not.toMatch(/createUser|updateUserById|temporaryPassword|randomBytes/i);
    expect(conversionRoute).toContain("convert_admission_to_student_v3");
    expect(conversionRoute).not.toMatch(/createUser|temporaryPassword|generatedPassword/i);
    expect(portalAdmin).toContain("Issue claim code");
    expect(portalAdmin).not.toMatch(/\/api\/portals\/credentials|temporary password|reset password/i);
    expect(claimMigration).toContain("portal_claim_required");
  });
});

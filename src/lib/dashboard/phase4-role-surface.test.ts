import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(resolve(process.cwd(), "src/app/[locale]/page.tsx"), "utf8").toLowerCase();
const teacher = readFileSync(resolve(process.cwd(), "src/components/teacher-home.tsx"), "utf8").toLowerCase();
const setup = readFileSync(resolve(process.cwd(), "src/app/[locale]/setup/page.tsx"), "utf8").toLowerCase();
const portal = readFileSync(resolve(process.cwd(), "src/app/portal/page.tsx"), "utf8").toLowerCase();

describe("Client V3 Phase 4 role surfaces", () => {
  it("resolves the authoritative navigation audience before rendering office data", () => {
    expect(dashboard).toContain("getnavigationaudience(workspace)");
    expect(dashboard).toContain('audience === "teacher"');
    expect(dashboard.indexOf('audience === "teacher"')).toBeLessThan(dashboard.indexOf("getoperationaldashboard(locale)"));
  });

  it("keeps teacher home focused on daily teacher work", () => {
    expect(teacher).toContain("my-students");
    expect(teacher).toContain("/attendance");
    expect(teacher).toContain("/quran");
    expect(teacher).not.toContain("/settings/configuration");
    expect(teacher).not.toContain("/staff");
    expect(teacher).not.toContain("/reports");
    expect(teacher).not.toContain("/admissions");
  });

  it("keeps dashboard quick routes inside the visible release scope", () => {
    expect(dashboard).toContain("/${locale}/portals");
    expect(dashboard).not.toContain("/${locale}/demo");
    expect(dashboard).not.toContain("/${locale}/programs");
    expect(dashboard).not.toContain("showfullsuite");
  });

  it("gives incomplete office setup one clear guided next action", () => {
    expect(dashboard).toContain("getguidedsetupsnapshot(locale)");
    expect(dashboard).toContain("!setup.steps.start");
    expect(dashboard).toContain("/${locale}/setup");
  });

  it("keeps guided setup server-gated to the office audience", () => {
    expect(setup).toContain("gettenantcontext()");
    expect(setup).toContain("getnavigationaudience(workspace)");
    expect(setup).toContain('audience !== "office"');
    expect(setup).toContain("/${locale}/forbidden");
    expect(setup).not.toContain("raw_user_meta_data");
  });

  it("keeps the portal separate from office configuration and admissions routes", () => {
    expect(portal).toContain("identity_person_links");
    expect(portal).toMatch(/link_type\)\s*===\s*"guardian"/);
    expect(portal).not.toContain("/settings/configuration");
    expect(portal).not.toContain("/admissions");
  });
});

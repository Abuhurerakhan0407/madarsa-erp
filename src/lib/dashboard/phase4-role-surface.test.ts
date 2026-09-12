import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(resolve(process.cwd(), "src/app/[locale]/page.tsx"), "utf8").toLowerCase();
const teacher = readFileSync(resolve(process.cwd(), "src/components/teacher-home.tsx"), "utf8").toLowerCase();

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

  it("gives incomplete office setup one clear guided next action", () => {
    expect(dashboard).toContain("getguidedsetupsnapshot(locale)");
    expect(dashboard).toContain("!setup.steps.start");
    expect(dashboard).toContain("/${locale}/setup");
  });
});

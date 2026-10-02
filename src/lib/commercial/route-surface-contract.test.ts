import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const app = (path: string) => resolve(process.cwd(), "src/app", path);
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const requiredPages = [
  "[locale]/page.tsx",
  "[locale]/admissions/page.tsx",
  "[locale]/students/page.tsx",
  "[locale]/programs/page.tsx",
  "[locale]/people-academics/page.tsx",
  "[locale]/students/lifecycle/page.tsx",
  "[locale]/attendance/page.tsx",
  "[locale]/quran/page.tsx",
  "[locale]/exams/page.tsx",
  "[locale]/portals/page.tsx",
  "[locale]/staff/page.tsx",
  "[locale]/payroll/page.tsx",
  "[locale]/fees/page.tsx",
  "[locale]/contributions/page.tsx",
  "[locale]/documents/page.tsx",
  "[locale]/reports/page.tsx",
  "[locale]/settings/configuration/page.tsx",
  "[locale]/assistant/page.tsx",
  "[locale]/access/page.tsx",
  "[locale]/my-students/page.tsx",
  "portal/page.tsx",
  "portal/claim/page.tsx",
  "portal/change-password/page.tsx"
] as const;

const retiredPages = [
  "[locale]/hostel/page.tsx",
  "[locale]/transport/page.tsx",
  "[locale]/library/page.tsx",
  "[locale]/communications/whatsapp/page.tsx",
  "[locale]/demo/hostel/page.tsx",
  "[locale]/demo/transport/page.tsx",
  "[locale]/demo/library/page.tsx"
] as const;

describe("commercial release route surface", () => {
  it("has concrete pages for every locked launch destination", () => {
    for (const page of requiredPages) expect(existsSync(app(page)), page).toBe(true);
  });

  it("does not ship removed commercial product pages", () => {
    for (const page of retiredPages) expect(existsSync(app(page)), page).toBe(false);
  });

  it("keeps student portal out while retaining Parent & Teacher Portal", () => {
    expect(existsSync(app("portal/page.tsx"))).toBe(true);
    expect(existsSync(app("[locale]/student-portal/page.tsx"))).toBe(false);
    expect(read("src/app/portal/page.tsx")).toContain("Parent & Teacher Portal");
  });

  it("keeps office and teacher navigation on concrete route families", () => {
    const nav = read("src/lib/navigation/client-v3-navigation.ts");
    for (const href of [
      "/admissions", "/students", "/attendance", "/quran", "/programs",
      "/people-academics", "/students/lifecycle", "/portals", "/staff",
      "/exams", "/documents", "/reports", "/fees", "/contributions",
      "/payroll", "/access", "/assistant", "/settings/configuration",
      "/my-students"
    ]) expect(nav).toContain(href);
  });
});

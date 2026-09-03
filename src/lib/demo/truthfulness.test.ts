import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findNavItem } from "../navigation/app-navigation";
import { demoModules } from "./modules";
import { getDemoPresentation } from "./presentation";

const demoPage = readFileSync(new URL("../../components/demo-module-page.tsx", import.meta.url), "utf8");
const legacyAcademics = readFileSync(new URL("../../app/[locale]/demo/academics/page.tsx", import.meta.url), "utf8");

function moduleById(id: string) {
  const foundModule = demoModules.find((item) => item.id === id);
  if (!foundModule) throw new Error(`Missing demo module: ${id}`);
  return foundModule;
}

describe("client-demo truthfulness", () => {
  it("marks deferred financial areas as demo-only in every locale", () => {
    for (const id of ["fees", "donations"] as const) {
      const presentation = getDemoPresentation(moduleById(id));
      expect(presentation.title.en).toMatch(/demo/i);
      expect(presentation.title.ur).toMatch(/ڈیمو/);
      expect(presentation.title.ar).toMatch(/عرض|تجريبي/);
      expect(presentation.description.en).toContain("not production-enabled yet");
    }

    expect(findNavItem("fees")?.labels.en).toBe("Fees & Accounting · Demo");
    expect(findNavItem("donations")?.labels.en).toBe("Donations & Sponsorships · Demo");
  });

  it("keeps payroll separate from the live Teachers navigation claim", () => {
    const staffNav = findNavItem("staff");
    expect(staffNav?.labels.en).toBe("Teachers");
    expect(staffNav?.labels.en).not.toMatch(/payroll/i);

    const staff = getDemoPresentation(moduleById("staff"));
    expect(staff.title.en).toContain("Payroll demo");
    expect(staff.description.en).toContain("payroll shown only as scripted demo data");
  });

  it("keeps AI visibly preview-only with no fictional production usage", () => {
    const ai = getDemoPresentation(moduleById("ai"));
    expect(ai.title.en).toContain("Preview");
    expect(ai.description.en).toContain("No production AI model or provider is connected");
    expect(ai.metrics.map((item) => item.value)).toEqual(["Not connected", "Disabled", "0", "Preview"]);
  });

  it("labels every scripted module page and retires the stale academics demo route", () => {
    expect(demoPage).toContain("demoUiCopy.demoData");
    expect(legacyAcademics).toContain('redirect(`/${locale}/people-academics`)');
  });
});

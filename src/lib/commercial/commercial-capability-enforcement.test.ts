import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

const modules = [
  { key: "fees_accounting", layout: "src/app/[locale]/fees/layout.tsx", api: "src/app/api/fees/route.ts" },
  { key: "donations_zakat_sponsorships", layout: "src/app/[locale]/contributions/layout.tsx", api: "src/app/api/contributions/route.ts" },
  { key: "payroll", layout: "src/app/[locale]/payroll/layout.tsx", api: "src/app/api/payroll/route.ts" }
] as const;

describe("commercial capability enforcement", () => {
  it.each(modules)("enforces $key at page and API boundaries", ({ key, layout, api }) => {
    const pageBoundary = root(layout);
    const apiBoundary = root(api);
    expect(pageBoundary).toContain("CapabilityBoundary");
    expect(pageBoundary).toContain(`capability="${key}"`);
    expect(apiBoundary).toContain("disabledCapabilityResponse");
    expect(apiBoundary).toContain(key);
  });

  it("gates both payroll reads and writes", () => {
    const payroll = root("src/app/api/payroll/route.ts");
    const occurrences = payroll.match(/disabledCapabilityResponse\(w,'payroll'\)/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });
});

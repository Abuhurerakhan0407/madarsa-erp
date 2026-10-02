import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = (path: string) => new URL(`../../../${path}`, import.meta.url);

const requiredIntegrationFiles = [
  "src/app/phase5-polish.css",
  "src/app/[locale]/staff/[employmentId]/page.module.css",
  "src/components/get-filter-form.tsx",
  "src/components/global-student-search.tsx",
  "src/components/route-pending-feedback.tsx",
  "src/lib/academics/current-session.ts",
  "src/lib/access/operator-permission.ts",
  "src/lib/navigation/office-surface.ts",
  "src/lib/reports/presentation.ts"
] as const;

describe("commercial RC integration completeness", () => {
  it("keeps every shared module referenced by the integrated release tree", () => {
    for (const path of requiredIntegrationFiles) {
      expect(existsSync(root(path)), path).toBe(true);
      expect(readFileSync(root(path), "utf8").trim().length, path).toBeGreaterThan(0);
    }
  });

  it("keeps payroll behind both app and API capability gates", () => {
    const access = readFileSync(root("src/lib/capabilities/access.ts"), "utf8");
    expect(access).toContain("/payroll");
    expect(access).toContain("/api\\/payroll");
    expect(access).toContain('"payroll"');
  });
});

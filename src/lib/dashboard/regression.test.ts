import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("operational dashboard regression", () => {
  const source = readFileSync(resolve(process.cwd(), "src/app/[locale]/page.tsx"), "utf8");
  const admissionsMetricMigration = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260831014500_fix_dashboard_admission_state_metrics.sql"),
    "utf8"
  );

  it("uses the governed operational workspace", () => {
    expect(source).toContain("getOperationalDashboard");
    expect(source).toContain("/attendance");
    expect(source).toContain("/quran");
    expect(source).toContain("/exams");
    expect(source).toContain("/staff");
    expect(source).toContain("/reports");
    expect(source).toContain("/documents");
  });

  it("does not restore presentation-only KPI literals", () => {
    expect(source).not.toContain(">4,000<");
    expect(source).not.toContain(">94.6%<");
    expect(source).not.toContain("₹18.6L");
    expect(source).not.toContain(">684<");
    expect(source).not.toContain(">612<");
    expect(source).not.toContain(">214<");
  });

  it("matches dashboard admission metrics to the real application state machine", () => {
    expect(admissionsMetricMigration).toContain("a.state='enrolled'");
    expect(admissionsMetricMigration).toContain("a.state not in ('enrolled','rejected','withdrawn','expired')");
    expect(admissionsMetricMigration).not.toContain("a.state='converted'");
    expect(admissionsMetricMigration).not.toContain("a.state='accepted'");
  });
});

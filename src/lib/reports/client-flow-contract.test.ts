import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("client reports flow", () => {
  it("uses report-specific filters instead of raw database parameter schemas", () => {
    const source = read("src/components/reports-hub.tsx");
    expect(source).toContain("reportSupportsParameter(selected,key)");
    expect(source).not.toContain("Object.prototype.hasOwnProperty.call(schema,key)");
  });

  it("requires a current preview before CSV or PDF export", () => {
    const source = read("src/components/reports-hub.tsx");
    expect(source).toContain("const canExport=Boolean(result&&result.report_key===selected)");
    expect(source).toContain("disabled={busy||!active||!canExport}");
  });

  it("guards rapid duplicate report actions and uses institution-aware filenames", () => {
    const source = read("src/components/reports-hub.tsx");
    expect(source).toContain("const actionLock=useRef(false)");
    expect(source).toContain("actionLock.current=true");
    expect(source).toContain("actionLock.current=false");
    expect(source).toContain("filenamePart(institutionName)");
  });

  it("ships database metadata cleanup for aggregate report filters", () => {
    const sql = read("supabase/migrations/20260925162500_client_reports_filter_contract.sql");
    expect(sql).toContain("'student_strength','absence_trend','late_trend','new_admissions'");
    expect(sql).not.toContain("student_person_id");
  });
});

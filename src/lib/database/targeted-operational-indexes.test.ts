import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260901153500_targeted_operational_indexes.sql"
);
const sql = readFileSync(migrationPath, "utf8");

describe("targeted operational indexes", () => {
  it("adds only the four evidence-backed indexes", () => {
    const creates = [...sql.matchAll(/create\s+index\s+if\s+not\s+exists\s+([a-z0-9_]+)/gi)].map(
      (match) => match[1]
    );

    expect(creates).toEqual([
      "transport_assignments_stop_state_idx",
      "mess_attendance_service_idx",
      "library_copies_title_branch_state_idx",
      "library_copies_branch_state_idx"
    ]);
  });

  it("keeps the advisor cleanup additive and non-destructive", () => {
    expect(sql).not.toMatch(/\bdrop\s+index\b/i);
    expect(sql).not.toMatch(/\bdrop\s+table\b/i);
    expect(sql).not.toMatch(/\balter\s+table\b/i);
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).not.toMatch(/\bupdate\b/i);
  });

  it("keeps each index tenant-leading and aligned to the observed workspace predicates", () => {
    expect(sql).toMatch(
      /transport_assignments\s*\(tenant_id,\s*stop_id,\s*state,\s*ends_on\)/i
    );
    expect(sql).toMatch(/mess_attendance\s*\(tenant_id,\s*meal_service_id\)/i);
    expect(sql).toMatch(
      /library_copies\s*\(tenant_id,\s*title_id,\s*branch_id,\s*state\)/i
    );
    expect(sql).toMatch(
      /library_copies\s*\(tenant_id,\s*branch_id,\s*state,\s*accession_number\)/i
    );
  });
});

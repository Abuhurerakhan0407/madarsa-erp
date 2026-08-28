import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260821134000_fix_private_runtime_service_role.sql"
  ),
  "utf8"
).toLowerCase();

describe("private runtime service-role grants", () => {
  it("allows only the server service role to traverse private runtime helpers", () => {
    expect(sql).toContain("grant usage on schema private to service_role");
    expect(sql).not.toContain("grant usage on schema private to anon");
    expect(sql).not.toContain("grant usage on schema private to authenticated");
  });

  it("revokes legacy public execute from private accounting trigger helpers", () => {
    expect(sql).toContain("private.assert_balanced_journal()");
    expect(sql).toContain("private.protect_posted_journal_line()");
    expect(sql).toContain("from public, anon, authenticated");
  });

  it("grants the admission and numbering helper chain to service_role", () => {
    expect(sql).toContain("private.admission_transition_allowed(text, text)");
    expect(sql).toContain("private.enforce_admission_transition()");
    expect(sql).toContain("private.reserve_number_sequence_for_period");
    expect(sql).toContain("private.reserve_formatted_number");
    expect(sql).toContain("to service_role");
  });
});

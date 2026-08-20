import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260821040500_bootstrap_concurrency_hardening.sql"
  ),
  "utf8"
).toLowerCase();

describe("tenant bootstrap concurrency hardening", () => {
  it("serializes bootstrap attempts for the same identity", () => {
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("hashtextextended(p_identity_id::text, 0)");
    expect(sql.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      sql.indexOf("identity is already onboarded")
    );
  });

  it("preserves service-role-only execution", () => {
    expect(sql).not.toContain("security definer");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });
});

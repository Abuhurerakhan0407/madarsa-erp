import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260821065500_bootstrap_institution_profile.sql"
  ),
  "utf8"
).toLowerCase();

describe("tenant bootstrap institution profile", () => {
  it("creates the institution profile in the same transaction", () => {
    expect(sql).toContain("insert into public.institution_profiles");
    expect(sql).toContain("tenant_id, display_name");
  });

  it("preserves per-identity concurrency protection", () => {
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("hashtextextended");
  });

  it("preserves browser-role execution denial", () => {
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });
});

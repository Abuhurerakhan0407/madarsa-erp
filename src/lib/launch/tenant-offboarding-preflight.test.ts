import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260901151503_tenant_offboarding_preflight.sql"
);
const sql = readFileSync(migrationPath, "utf8");

describe("tenant offboarding preflight migration", () => {
  it("is explicitly read-only and preflight-only", () => {
    expect(sql).toContain("'preflight_only', true");
    expect(sql).toContain("'destructive_execution_supported', false");
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).not.toMatch(/\binsert\s+into\b/i);
    expect(sql).not.toMatch(/\bupdate\s+[a-z0-9_.\"]+\s+set\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/\bdrop\s+(?:table|schema)\b/i);
  });

  it("keeps the function service-role-only with an empty search path", () => {
    expect(sql).toMatch(/security\s+definer/i);
    expect(sql).toMatch(/set\s+search_path\s*=\s*''/i);
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.tenant_offboarding_preflight_v1\(bigint\)\s+from\s+public,\s*anon,\s*authenticated/i
    );
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.tenant_offboarding_preflight_v1\(bigint\)\s+to\s+service_role/i
    );
  });

  it("inventories tenant-scoped base tables using catalog-derived identifiers and a bound tenant id", () => {
    expect(sql).toContain("from pg_catalog.pg_class c");
    expect(sql).toContain("join pg_catalog.pg_namespace n");
    expect(sql).toContain("from pg_catalog.pg_attribute a");
    expect(sql).toContain("c.relkind in ('r', 'p')");
    expect(sql).toContain("a.attname = 'tenant_id'");
    expect(sql).toContain("where tenant_id = $1");
    expect(sql).toContain("using p_tenant_id");
  });

  it("checks both tenant-level and scoped governance blockers", () => {
    expect(sql).toContain("'legal_hold_flag', t.legal_hold");
    expect(sql).toContain("from public.legal_holds lh");
    expect(sql).toContain("lh.state = 'active'");
    expect(sql).toContain("from public.data_deletion_jobs dj");
    expect(sql).toContain("dj.state not in ('completed', 'cancelled')");
    expect(sql).toContain("from public.data_retention_policies rp");
  });

  it("does not pretend database inventory covers Storage object bytes", () => {
    expect(sql).toContain("'storage_inventory_included', false");
    expect(sql).toContain("Storage object bytes require separate tenant-path inventory");
  });
});

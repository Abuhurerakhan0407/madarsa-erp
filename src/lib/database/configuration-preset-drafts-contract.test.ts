import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260821071500_apply_configuration_preset_drafts.sql"
  ),
  "utf8"
).toLowerCase();

describe("configuration preset draft migration", () => {
  it("verifies tenant configuration permission before writing", () => {
    expect(sql).toContain("settings.configuration.manage");
    expect(sql).toContain("membership_roles");
    expect(sql).toContain("role_permissions");
  });

  it("creates versioned terminology and attendance drafts atomically", () => {
    expect(sql).toContain("insert into public.terminology_sets");
    expect(sql).toContain("insert into public.terminology_entries");
    expect(sql).toContain("insert into public.attendance_status_sets");
    expect(sql).toContain("configuration.preset_draft");
    expect(sql).toContain("pg_advisory_xact_lock");
  });

  it("keeps browser roles from executing privileged mutation", () => {
    expect(sql).not.toContain("security definer");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });
});

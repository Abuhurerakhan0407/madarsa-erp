import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260821090000_setup_admissions_foundation.sql"),
  "utf8"
).toLowerCase();

describe("admissions foundation migration", () => {
  it("creates all prerequisites in one audited transaction", () => {
    expect(sql).toContain("function public.setup_admissions_foundation");
    expect(sql).toContain("insert into public.academic_sessions");
    expect(sql).toContain("insert into public.programs");
    expect(sql).toContain("insert into public.form_definitions");
    expect(sql).toContain("insert into public.form_versions");
    expect(sql).toContain("insert into public.workflow_definitions");
    expect(sql).toContain("insert into public.workflow_versions");
    expect(sql).toContain("'admissions.foundation_setup'");
    expect(sql).toContain("pg_advisory_xact_lock");
  });

  it("requires tenant membership plus all setup permissions", () => {
    expect(sql).toContain("'academics.structure.manage'");
    expect(sql).toContain("'settings.configuration.manage'");
    expect(sql).toContain("'settings.configuration.publish'");
    expect(sql).toContain("having count(distinct rp.permission_code) = 3");
  });

  it("publishes only the form and workflow while keeping browser execution denied", () => {
    expect(sql).not.toContain("security definer");
    expect(sql).toContain("'published'");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260821100000_submit_public_admission.sql"),
  "utf8"
).toLowerCase();

describe("public admission submission migration", () => {
  it("creates application revision, workflow instance and audit in one transaction", () => {
    expect(sql).toContain("function public.submit_public_admission");
    expect(sql).toContain("insert into public.applications");
    expect(sql).toContain("insert into public.application_versions");
    expect(sql).toContain("insert into public.workflow_instances");
    expect(sql).toContain("'submitted'");
    expect(sql).toContain("'admissions.application.submitted_public'");
  });

  it("revalidates configured prerequisites and required published fields", () => {
    expect(sql).toContain("fd.audience = 'public'");
    expect(sql).toContain("fv.status = 'published'");
    expect(sql).toContain("wv.status = 'published'");
    expect(sql).toContain("wv.validation_result->>'start_key' = 'submitted'");
    expect(sql).toContain("unknown admission form field");
    expect(sql).toContain("required admission field missing");
  });

  it("rate limits by hashed source and denies browser execution", () => {
    expect(sql).toContain("public_admission_submit");
    expect(sql).toContain("interval '15 minutes'");
    expect(sql).toContain("v_recent_attempts >= 5");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).not.toContain("security definer");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });
});

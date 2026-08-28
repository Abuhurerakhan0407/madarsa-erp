import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contract = readFileSync(
  new URL("../../../database/contracts/phase5_admissions.sql", import.meta.url),
  "utf8"
);

const runtimeScopes = readFileSync(
  new URL("../../../supabase/migrations/20260828112449_enforce_admissions_runtime_membership_scopes.sql", import.meta.url),
  "utf8"
);

const tables = [
  "enquiries",
  "applications",
  "application_versions",
  "application_documents",
  "application_reviews",
  "admission_assessments",
  "admission_decisions",
  "admission_offers",
  "waitlist_entries",
  "admission_conversions",
  "admission_followups"
] as const;

describe("Phase 5 database contract", () => {
  it.each([
    ["progress_admission_staff", "v_application.branch_id"],
    ["setup_student_number_sequence", "p_branch_id"]
  ])("checks membership timing and branch scope in %s", (name, branch) => {
    const body = runtimeScopes.split(`create or replace function public.${name}(`)[1].split("$$;")[0];
    expect(body).toContain("m.starts_at is null or m.starts_at <= now()");
    expect(body).toContain("m.ends_at is null or m.ends_at > now()");
    expect(body).toContain("m.all_branches");
    expect(body).toContain("mbs.tenant_id = m.tenant_id");
    expect(body).toContain("mbs.membership_id = m.id");
    expect(body).toContain(`mbs.branch_id = ${branch}`);
    expect(body).not.toMatch(/security\s+definer/i);
  });

  it("authorizes staff before revealing transition conflicts", () => {
    expect(runtimeScopes.indexOf("admission action permission denied")).toBeLessThan(
      runtimeScopes.indexOf("admission state transition conflict")
    );
  });

  it("declares complete admission records", () => {
    for (const table of tables) expect(contract).toContain(`create table public.${table}`);
  });

  it("protects all tables with forced RLS", () => {
    for (const table of tables) {
      expect(contract).toContain(`alter table public.${table} enable row level security`);
      expect(contract).toContain(`alter table public.${table} force row level security`);
    }
  });

  it("pins form and workflow versions", () => {
    expect(contract).toContain("form_version_id bigint not null");
    expect(contract).toContain("workflow_version_id bigint not null");
  });

  it("keeps critical mutations server-only", () => {
    expect(contract).not.toMatch(/grant\s+(insert|update|delete|all)/i);
    expect(contract).toContain("grant execute on function private.convert_admission");
    expect(contract).toContain("to service_role");
  });

  it("makes conversion idempotent and unique", () => {
    expect(contract).toContain("unique (tenant_id, application_id)");
    expect(contract).toContain("unique (tenant_id, idempotency_key)");
    expect(contract).toContain("for update");
  });

  it("keeps submissions and decisions append-only", () => {
    expect(contract).toContain("application_versions_append_only");
    expect(contract).toContain("admission_decisions_append_only");
    expect(contract).toContain("admission_conversions_append_only");
  });
});

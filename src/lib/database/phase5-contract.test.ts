import { readFileSync, readdirSync } from "node:fs";
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

function latestFunction(name: string) {
  const directory = new URL("../../../supabase/migrations/", import.meta.url);
  const definitions = readdirSync(directory).sort().map((file) => readFileSync(new URL(file, directory), "utf8"))
    .filter((sql) => sql.includes(`create or replace function public.${name}(`));
  return definitions.at(-1)!.split(`create or replace function public.${name}(`)[1].split("$$;")[0];
}

describe("Phase 5 database contract", () => {
  it.each([
    "progress_admission_staff", "setup_student_number_sequence", "convert_admission_to_student",
    "setup_admissions_foundation", "apply_configuration_preset_drafts"
  ])("rejects inactive roles and future membership in %s", (name) => {
    const body = latestFunction(name);
    expect(body).toContain("join public.roles r");
    expect(body).toContain("r.status = 'active'");
    expect(body).toContain("m.starts_at is null or m.starts_at <= now()");
  });

  it("checks branch scope when activating admissions", () => {
    const body = latestFunction("setup_admissions_foundation");
    expect(body).toContain("mbs.membership_id = m.id");
    expect(body).toContain("mbs.branch_id = p_branch_id");
  });

  it("persists conversion linkage instead of choosing a later enrollment on retry", () => {
    const body = latestFunction("convert_admission_to_student");
    expect(body).toContain("insert into public.admission_conversions");
    const retry = body.split("if v_application.state = 'enrolled' then")[1].split("return jsonb_build_object")[0];
    expect(retry).toContain("public.admission_conversions c");
    expect(retry).toContain("e.id = c.enrollment_id");
    expect(retry).not.toContain("order by e.id desc");
  });

  it.each([
    "application_versions", "application_documents", "application_reviews",
    "admission_assessments", "admission_decisions", "admission_offers",
    "waitlist_entries", "admission_conversions"
  ])("requires a branch-visible parent for %s reads", (table) => {
    const policy = contract.split(`create policy ${table}_scoped_read`)[1].split(";")[0];
    expect(policy).toContain("from public.applications a");
    expect(policy).toContain(`a.tenant_id = ${table}.tenant_id`);
    expect(policy).toContain(`a.id = ${table}.application_id`);
    expect(policy).toContain("a.branch_id)");
    expect(policy).not.toContain(", null)");
  });

  it("scopes both follow-up target types through their visible parent", () => {
    const policy = contract.split("create policy admission_followups_scoped_read")[1].split(";")[0];
    expect(policy).toContain("from public.enquiries e");
    expect(policy).toContain("e.tenant_id = admission_followups.tenant_id");
    expect(policy).toContain("e.id = admission_followups.enquiry_id");
    expect(policy).toContain("e.branch_id)");
    expect(policy).toContain("from public.applications a");
    expect(policy).toContain("a.tenant_id = admission_followups.tenant_id");
    expect(policy).toContain("a.id = admission_followups.application_id");
    expect(policy).toContain("a.branch_id)");
  });

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

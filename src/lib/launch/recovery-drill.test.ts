import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../../../.github/workflows/recovery-drill.yml", import.meta.url), "utf8");
const script = readFileSync(new URL("../../../scripts/recovery-drill.sh", import.meta.url), "utf8");
const scopeSmokeScript = readFileSync(
  new URL("../../../scripts/recovery-scope-smoke.sh", import.meta.url),
  "utf8"
);
const applicationSmokeScript = readFileSync(
  new URL("../../../scripts/recovery-application-smoke.sh", import.meta.url),
  "utf8"
);
const docs = readFileSync(new URL("../../../docs/recovery-drill.md", import.meta.url), "utf8");

const validPoolerUrl =
  "postgresql://postgres.dysfnytqpbfxpmerkyaz:secret@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
const validLocalRestoreUrl = "postgresql://postgres:secret@127.0.0.1:54329/postgres";

function runValidation(overrides: Record<string, string>) {
  return spawnSync("bash", ["scripts/recovery-drill.sh"], {
    encoding: "utf8",
    env: {
      ...process.env,
      SOURCE_DB_URL: validPoolerUrl,
      RECOVERY_PASSPHRASE: "test-only-recovery-passphrase-32-chars",
      RESTORE_DB_URL: validLocalRestoreUrl,
      RECOVERY_OUTPUT_DIR: `/tmp/madarsa-recovery-validation-${process.pid}`,
      TARGET_RPO_HOURS: "24",
      ...overrides
    }
  });
}

describe("database recovery drill automation", () => {
  it("keeps production reads controlled through repository secrets", () => {
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("secrets.MADARSA_ERP_DATABASE_URL");
    expect(workflow).toContain("secrets.MADARSA_ERP_RECOVERY_PASSPHRASE");
    expect(workflow).not.toMatch(/schedule:/);
    expect(workflow).not.toMatch(/SOURCE_DB_URL:\s*postgresql:\/\//);
  });

  it("pins the recovery tooling and initialized local Supabase target", () => {
    expect(workflow).toContain('SUPABASE_CLI_VERSION: "2.116.0"');
    expect(workflow).toContain("82cb424bc13cd029a66cb43bc537315cee9068cc6237b7d4b7f8f8949800d251");
    expect(workflow).toContain('RESTORE_DB_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres');
    expect(workflow).toContain('supabase init --workdir "${TARGET_DIR}"');
    expect(workflow).toContain('supabase start --workdir "${TARGET_DIR}"');
    expect(workflow).toContain("auth.audit_log_entries");
    expect(workflow).not.toContain("supabase/postgres:17.6.1.136");
    expect(script).toContain('EXPECTED_PROJECT_REF="dysfnytqpbfxpmerkyaz"');
    expect(script).toContain("approved Madarsa ERP Supabase project endpoint");
    expect(script).toContain("localhost, 127.0.0.1, or ::1");
  });

  it("rejects a source URL when the project ref appears only in credentials", () => {
    const result = runValidation({
      SOURCE_DB_URL:
        "postgresql://postgres:dysfnytqpbfxpmerkyaz@evil.example.com:5432/postgres"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("approved Madarsa ERP Supabase project endpoint");
    expect(result.stderr).not.toContain("dysfnytqpbfxpmerkyaz@evil.example.com");
  });

  it("rejects libpq host/service query overrides on the source URL", () => {
    const result = runValidation({
      SOURCE_DB_URL: `${validPoolerUrl}?host=evil.example.com`
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("approved Madarsa ERP Supabase project endpoint");
    expect(result.stderr).not.toContain("evil.example.com");
  });

  it("accepts the approved pooler identity before rejecting a non-local restore host", () => {
    const result = runValidation({
      RESTORE_DB_URL: "postgresql://postgres:localhost@evil.example.com:5432/postgres"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Restore target must resolve directly to localhost");
    expect(result.stderr).not.toContain("evil.example.com");
  });

  it("rejects libpq host/service query overrides on an otherwise local restore URL", () => {
    const result = runValidation({
      RESTORE_DB_URL: `${validLocalRestoreUrl}?host=evil.example.com`
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Restore target must resolve directly to localhost");
    expect(result.stderr).not.toContain("evil.example.com");
  });

  it("uses Supabase-aware dump, encryption, and restore verification", () => {
    expect(script).toContain("supabase db dump");
    expect(script).toContain("--role-only");
    expect(script).toContain("--data-only");
    expect(script).toContain("openssl enc -aes-256-cbc -salt -pbkdf2");
    expect(script).toContain("--single-transaction");
    expect(script).toContain("student_profiles");
    expect(script).toContain("attendance_records");
    expect(script).toContain("SOURCE_COUNTS");
    expect(script).toContain("RESTORED_COUNTS");
    expect(script).toContain("command output was withheld from logs");
  });

  it("verifies Auth identities, managed roles, privileged RPCs, and zero-blob Storage applicability", () => {
    expect(workflow).toContain("scripts/recovery-scope-smoke.sh");
    expect(workflow).toContain("Verify Auth and Storage recovery scope");
    expect(scopeSmokeScript).toContain("auth.users");
    expect(scopeSmokeScript).toContain("auth.identities");
    expect(scopeSmokeScript).toContain("supabase_auth_admin");
    expect(scopeSmokeScript).toContain("supabase_storage_admin");
    expect(scopeSmokeScript).toContain("bootstrap_tenant");
    expect(scopeSmokeScript).toContain("has_function_privilege('anon'");
    expect(scopeSmokeScript).toContain("has_function_privilege('authenticated'");
    expect(scopeSmokeScript).toContain(".restore.privileged_rpc_boundary_verified = true");
    expect(scopeSmokeScript).toContain("storage.objects");
    expect(scopeSmokeScript).toContain("SOURCE_STORAGE_OBJECT_COUNT");
    expect(scopeSmokeScript).toContain('SOURCE_STORAGE_OBJECT_COUNT}" != "0"');
    expect(scopeSmokeScript).toContain("blob backup/restore must be implemented and proven");
    expect(scopeSmokeScript).toContain("database/contracts/phase2_storage.sql");
    expect(scopeSmokeScript).toContain(".restore.auth_verified = true");
    expect(scopeSmokeScript).toContain(".restore.storage_verified = true");
    expect(scopeSmokeScript).toContain(".launch_gate.backup_restore_drill_passed = false");
  });

  it("runs GET-only application and operational-module probes against restored Supabase", () => {
    expect(workflow).toContain("scripts/recovery-application-smoke.sh");
    expect(workflow).toContain("Verify restored application read path");
    expect(workflow).toContain("pnpm install --no-frozen-lockfile");
    expect(applicationSmokeScript).toContain("supabase status -o env");
    expect(applicationSmokeScript).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(applicationSmokeScript).toContain("SUPABASE_SECRET_KEY");
    expect(applicationSmokeScript).toContain("pnpm exec next dev --hostname 127.0.0.1");
    expect(applicationSmokeScript).toContain("--request GET");
    expect(applicationSmokeScript).toContain("/apply/abu-school?lang=en");
    expect(applicationSmokeScript).toContain("Al-Noor Islamic Academy");
    expect(applicationSmokeScript).toContain("Central Campus");
    for (const table of [
      "student_profiles",
      "attendance_records",
      "documents",
      "transport_routes",
      "hostels",
      "library_titles",
      "memberships"
    ]) {
      expect(applicationSmokeScript).toContain(table);
    }
    expect(applicationSmokeScript).toContain('"students:student_profiles:person_id"');
    expect(applicationSmokeScript).toContain('"student_profiles:person_id"');
    expect(applicationSmokeScript).toContain("select_column");
    expect(applicationSmokeScript).toContain("key_column");
    expect(applicationSmokeScript).not.toContain("student_profiles?select=id");
    expect(applicationSmokeScript).toContain("anonymous_boundaries");
    expect(applicationSmokeScript).toContain("sensitive_row_exposed: false");
    expect(applicationSmokeScript).toContain("outbound_provider_side_effects_emitted: false");
    expect(applicationSmokeScript).toContain("mutation_performed: false");
    expect(applicationSmokeScript).toContain(".restore.application_verified = true");
    expect(applicationSmokeScript).toContain(".restore.operational_module_reads_verified = true");
    expect(applicationSmokeScript).toContain(".restore.anonymous_access_boundary_verified = true");
    expect(applicationSmokeScript).not.toMatch(/--request\s+(POST|PUT|PATCH|DELETE)/);
  });

  it("closes the commercial restore gate only after every recovery prerequisite passes", () => {
    expect(script).toContain('backup_restore_drill_passed: false');
    expect(script).toContain('gate_can_be_closed: false');
    expect(script).toContain('storage_verified: false');
    expect(script).toContain('application_verified: false');
    expect(scopeSmokeScript).toContain(".launch_gate.backup_restore_drill_passed = false");
    expect(applicationSmokeScript).toContain(
      "database_verified auth_verified managed_role_baseline_verified privileged_rpc_boundary_verified storage_verified"
    );
    expect(applicationSmokeScript).toContain(".restore.storage_blob_restore_required == false");
    expect(applicationSmokeScript).toContain(".launch_gate.backup_restore_drill_passed = true");
    expect(applicationSmokeScript).toContain(".launch_gate.gate_can_be_closed = true");
    expect(docs).toContain("Never create synthetic recovery evidence");
  });
});

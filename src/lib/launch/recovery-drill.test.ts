import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../../../.github/workflows/recovery-drill.yml", import.meta.url), "utf8");
const script = readFileSync(new URL("../../../scripts/recovery-drill.sh", import.meta.url), "utf8");
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
  it("is manual and reads production only through repository secrets", () => {
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("secrets.MADARSA_ERP_DATABASE_URL");
    expect(workflow).toContain("secrets.MADARSA_ERP_RECOVERY_PASSPHRASE");
    expect(workflow).not.toMatch(/schedule:/);
    expect(workflow).not.toMatch(/SOURCE_DB_URL:\s*postgresql:\/\//);
  });

  it("pins the recovery tooling and initialized local Supabase target", () => {
    expect(workflow).toContain('SUPABASE_CLI_VERSION: "2.116.0"');
    expect(workflow).toContain("82cb424bc13cd029a66cb43bc537315cee9068cc6237b7f8f8949800d251");
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

  it("never upgrades database-only evidence into a commercial restore pass", () => {
    expect(script).toContain('backup_restore_drill_passed: false');
    expect(script).toContain('gate_can_be_closed: false');
    expect(script).toContain('storage_verified: false');
    expect(script).toContain('application_verified: false');
    expect(docs).toContain("Never create synthetic recovery evidence");
  });
});

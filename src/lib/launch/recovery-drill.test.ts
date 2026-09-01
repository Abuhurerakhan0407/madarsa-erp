import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../../../.github/workflows/recovery-drill.yml", import.meta.url), "utf8");
const script = readFileSync(new URL("../../../scripts/recovery-drill.sh", import.meta.url), "utf8");
const docs = readFileSync(new URL("../../../docs/recovery-drill.md", import.meta.url), "utf8");

describe("database recovery drill automation", () => {
  it("is manual and reads production only through repository secrets", () => {
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("secrets.MADARSA_ERP_DATABASE_URL");
    expect(workflow).toContain("secrets.MADARSA_ERP_RECOVERY_PASSPHRASE");
    expect(workflow).not.toMatch(/schedule:/);
    expect(workflow).not.toMatch(/SOURCE_DB_URL:\s*postgresql:\/\//);
  });

  it("pins the recovery tooling and isolated Supabase Postgres target", () => {
    expect(workflow).toContain('SUPABASE_CLI_VERSION: "2.116.0"');
    expect(workflow).toContain("82cb424bc13cd029a66cb43bc537315cee9068cc6237b7d4b7f8f8949800d251");
    expect(workflow).toContain("supabase/postgres:17.6.1.136");
    expect(script).toContain('EXPECTED_PROJECT_REF="dysfnytqpbfxpmerkyaz"');
    expect(script).toContain("Restore target must be local/isolated");
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
  });

  it("never upgrades database-only evidence into a commercial restore pass", () => {
    expect(script).toContain('backup_restore_drill_passed: false');
    expect(script).toContain('gate_can_be_closed: false');
    expect(script).toContain('storage_verified: false');
    expect(script).toContain('application_verified: false');
    expect(docs).toContain("Never create synthetic recovery evidence");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contract = readFileSync(new URL("../../../database/contracts/phase14_hardening.sql", import.meta.url), "utf8");
const required = ["data_retention_policies","legal_holds","data_deletion_jobs","data_deletion_job_items","backup_evidence","restore_drills","operational_incidents","security_rate_limit_events","audit_export_jobs"] as const;

describe("Phase 14 database contract", () => {
  it("declares retention, recovery, and incident evidence", () => {
    for (const table of required) expect(contract).toContain(`create table public.${table}`);
  });
  it("blocks deletion without approval and hold checks", () => {
    expect(contract).toContain("legal_hold_checked_at timestamptz");
    expect(contract).toContain("deletion_job_approval_check");
  });
  it("stores measured recovery evidence", () => {
    expect(contract).toContain("measured_rpo_hours");
    expect(contract).toContain("storage_verified boolean");
  });
  it("keeps browser writes closed", () => {
    expect(contract).not.toMatch(/grant\s+(insert|update|delete|all)/i);
  });
});

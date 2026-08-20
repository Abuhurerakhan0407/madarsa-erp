import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contract = readFileSync(
  new URL("../../../database/contracts/phase6_attendance_portals.sql", import.meta.url),
  "utf8"
);

const tables = [
  "attendance_sessions", "attendance_rosters", "attendance_roster_members",
  "attendance_records", "attendance_corrections", "leave_requests", "leave_decisions",
  "attendance_alerts", "lesson_plans", "homework_assignments", "homework_submissions",
  "portal_notices", "portal_notice_receipts"
] as const;

describe("Phase 6 database contract", () => {
  it("declares daily workflow tables", () => {
    for (const table of tables) expect(contract).toContain(`create table public.${table}`);
  });
  it("keeps unmarked distinct", () => {
    expect(contract).toContain("'present','absent','late','leave','excused','unmarked'");
  });
  it("requires idempotency", () => {
    expect(contract).toContain("unique (tenant_id, idempotency_key, person_id)");
    expect(contract).toContain("unique (tenant_id, idempotency_key)");
  });
  it("preserves original attendance and decisions", () => {
    expect(contract).toContain("attendance_records_append_only");
    expect(contract).toContain("leave_decisions_append_only");
  });
  it("keeps browser writes closed", () => {
    expect(contract).not.toMatch(/grant\s+(insert|update|delete|all)/i);
  });
});

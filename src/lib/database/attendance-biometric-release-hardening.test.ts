import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260917174200_attendance_biometric_release_hardening.sql"),
  "utf8"
).toLowerCase();

const deviceRoute = readFileSync(resolve(process.cwd(), "src/app/api/attendance/devices/route.ts"), "utf8").toLowerCase();
const mappingRoute = readFileSync(resolve(process.cwd(), "src/app/api/attendance/device-mappings/route.ts"), "utf8").toLowerCase();
const applyRoute = readFileSync(resolve(process.cwd(), "src/app/api/attendance/device-events/[eventId]/apply/route.ts"), "utf8").toLowerCase();
const rotateRoute = readFileSync(resolve(process.cwd(), "src/app/api/attendance/devices/[deviceId]/rotate/route.ts"), "utf8").toLowerCase();
const ingestRoute = readFileSync(resolve(process.cwd(), "src/app/api/attendance/device-ingest/route.ts"), "utf8").toLowerCase();

describe("commercial biometric attendance release hardening", () => {
  it("retires non-biometric operational paths without deleting history", () => {
    expect(migration).toContain("where modality <> 'biometric' and state = 'active'");
    expect(migration).toContain("enforce_biometric_attendance_scope_v1");
    expect(migration).toContain("retired attendance modality");
    expect(migration).not.toContain("delete from public.attendance_device");
  });

  it("permission-gates event application before operational mutation", () => {
    expect(migration).toContain("operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'attendance.student.mark')");
    expect(migration).toContain("operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hr.employee.manage')");
    expect(migration).toContain("set state='matched',error_reason=left(sqlerrm,500)");
  });

  it("keeps biometric ingestion authoritative and retryable", () => {
    expect(migration).toContain("and d.modality='biometric'");
    expect(migration).toContain("if v_modality <> 'biometric' then raise exception 'retired attendance modality'");
    expect(migration).toContain("e.state in('received','matched','applied')");
    expect(migration).not.toContain("'mapped'");
  });

  it("protects operator mutation routes with same-origin and JSON guards", () => {
    for (const route of [deviceRoute, mappingRoute, applyRoute, rotateRoute]) {
      expect(route).toContain("issameoriginrequest(request)");
      expect(route).toContain("isjsonrequest(request)");
      expect(route).toContain("getverifiedidentity()");
      expect(route).toContain("gettenantcontext()");
    }
  });

  it("keeps external ingest biometric-only and stream bounded without requiring browser same-origin", () => {
    expect(ingestRoute).toContain("isjsonrequest(request)");
    expect(ingestRoute).toContain("readboundedjson(request, 16_384)");
    expect(ingestRoute).toContain('body.modality !== "biometric"');
    expect(ingestRoute).toContain('modality: "biometric"');
    expect(ingestRoute).not.toContain('modality !== "nfc"');
    expect(ingestRoute).not.toContain("issameoriginrequest(request)");
  });

  it("keeps database functions service-role only", () => {
    expect(migration).toContain("revoke all on function public.receive_attendance_device_event_v1");
    expect(migration).toContain("grant execute on function public.receive_attendance_device_event_v1");
    expect(migration).toContain("revoke all on function public.apply_attendance_device_event_v1");
    expect(migration).toContain("grant execute on function public.apply_attendance_device_event_v1");
    expect(migration).not.toContain("to authenticated;");
  });
});

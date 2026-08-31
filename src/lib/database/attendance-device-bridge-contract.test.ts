import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const runtime = readFileSync(resolve(process.cwd(), "supabase/migrations/20260831054000_attendance_device_bridge.sql"), "utf8").toLowerCase();
const hardening = readFileSync(resolve(process.cwd(), "supabase/migrations/20260831054200_attendance_device_bridge_hardening.sql"), "utf8").toLowerCase();
const applyFix = readFileSync(resolve(process.cwd(), "supabase/migrations/20260831054400_attendance_device_apply_request_key.sql"), "utf8").toLowerCase();
const sql = `${runtime}\n${hardening}\n${applyFix}`;

describe("attendance device bridge database contract", () => {
  it("keeps device configuration, subject mappings, and event inbox tenant scoped", () => {
    expect(runtime).toContain("create table if not exists public.attendance_devices");
    expect(runtime).toContain("create table if not exists public.attendance_device_subject_mappings");
    expect(runtime).toContain("create table if not exists public.attendance_device_events");
    expect(runtime).toContain("foreign key (tenant_id,branch_id) references public.branches");
    expect(runtime).toContain("alter table public.attendance_devices enable row level security");
    expect(runtime).toContain("alter table public.attendance_device_subject_mappings enable row level security");
    expect(runtime).toContain("alter table public.attendance_device_events enable row level security");
  });

  it("stores token hashes and never raw device credentials", () => {
    expect(sql).toContain("token_hash");
    expect(sql).toContain("digest(v_token,'sha256')");
    expect(sql).toContain("token_hint");
    expect(sql).not.toContain("ingest_token text not null");
  });

  it("rejects raw biometric material at the governed ingest boundary", () => {
    expect(hardening).toContain("raw biometric material must not be sent to erp");
    expect(hardening).toContain("biometric_template");
    expect(hardening).toContain("fingerprint_image");
    expect(hardening).toContain("face_image");
    expect(hardening).toContain("raw_template");
  });

  it("routes reconciled events through the existing attendance runtimes", () => {
    expect(sql).toContain("public.ensure_student_daily_attendance");
    expect(sql).toContain("public.mark_student_attendance");
    expect(sql).toContain("public.record_hr_attendance_v1");
    expect(applyFix).toContain("attendance-device-event:");
    expect(sql).toContain("'biometric'");
    expect(sql).toContain("'nfc'");
    expect(sql).toContain("'device'");
  });

  it("makes the external device key unambiguous and ingestion idempotent", () => {
    expect(hardening).toContain("attendance_devices_external_device_key_unique");
    expect(hardening).toContain("lower(external_device_key)");
    expect(runtime).toContain("unique (tenant_id,device_id,external_event_id)");
    expect(hardening).toContain("on conflict(tenant_id,device_id,external_event_id)");
  });

  it("keeps bridge tables and functions service-role only", () => {
    expect(runtime).toContain("revoke all on public.attendance_devices,public.attendance_device_subject_mappings,public.attendance_device_events from public,anon,authenticated");
    expect(runtime).toContain("grant all on public.attendance_devices,public.attendance_device_subject_mappings,public.attendance_device_events to service_role");
    expect(sql).toContain("revoke all on function public.receive_attendance_device_event_v1");
    expect(sql).toContain("grant execute on function public.receive_attendance_device_event_v1");
    expect(sql).not.toContain("grant execute on function public.receive_attendance_device_event_v1(text,text,text,text,text,text,timestamptz,jsonb) to authenticated");
  });
});

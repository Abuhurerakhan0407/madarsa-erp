import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260920230000_attendance_biometric_auto_apply_arrival.sql"
);
const sql = readFileSync(migrationPath, "utf8").toLowerCase();

describe("biometric auto-apply and arrival notification contract", () => {
  it("auto-applies only mapped device events through the existing governed attendance runtime", () => {
    expect(sql).toContain("if v_event.mapping_id is not null and v_event.state<>'applied'");
    expect(sql).toContain("public.apply_attendance_device_event_v1(");
    expect(sql).toContain("v_device.created_by_membership_id");
    expect(sql).toContain("m.status='active'");
    expect(sql).toContain("membership_branch_scopes");
  });

  it("keeps failed automatic application retryable instead of losing the punch", () => {
    expect(sql).toContain("state='matched'");
    expect(sql).toContain("error_reason=left(sqlerrm,500)");
    expect(sql).toContain("'retryable',v_retryable");
  });

  it("keeps unmatched subjects in the inbox without manufacturing attendance", () => {
    expect(sql).toContain("case when v_mapping.id is null then 'received' else 'matched' end");
    expect(sql).toContain("'matched',v_event.mapping_id is not null");
  });

  it("emits one biometric arrival notification per student local day", () => {
    expect(sql).toContain("emit_biometric_arrival_notification_v1");
    expect(sql).toContain("'attendance.biometric_arrival'");
    expect(sql).toContain("e.id<>p_device_event_id");
    expect(sql).toContain("e.event_type in('presence','check_in')");
    expect(sql).toContain("(e.occurred_at at time zone v_timezone)::date=v_local_date");
    expect(sql).toContain("student arrived");
  });

  it("never accepts raw biometric material", () => {
    for (const key of [
      "biometric_template",
      "fingerprint",
      "fingerprint_image",
      "face_image",
      "raw_image",
      "raw_template"
    ]) expect(sql).toContain(key);
    expect(sql).toContain("raw biometric material must not be sent to erp");
  });

  it("keeps both entrypoints unavailable to browser roles", () => {
    expect(sql).toContain(
      "revoke all on function public.receive_attendance_device_event_v1(text,text,text,text,text,text,timestamptz,jsonb)"
    );
    expect(sql).toContain(
      "revoke all on function public.emit_biometric_arrival_notification_v1(bigint,bigint,bigint,bigint,timestamptz)"
    );
    expect(sql).not.toMatch(
      /grant\s+execute\s+on\s+function\s+public\.(?:receive_attendance_device_event_v1|emit_biometric_arrival_notification_v1)[\s\S]*?\bto\s+(?:public|anon|authenticated)\b/i
    );
  });
});

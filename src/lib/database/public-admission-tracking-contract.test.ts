import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260821110000_track_public_admission.sql"),
  "utf8"
).toLowerCase();

describe("public admission tracking migration", () => {
  it("returns status metadata without applicant answers", () => {
    expect(sql).toContain("function public.track_public_admission");
    expect(sql).toContain("'state', v_state");
    expect(sql).toContain("'tenant_name', v_tenant_name");
    expect(sql).toContain("'program_labels', v_program_labels");
    expect(sql).toContain("'session_labels', v_session_labels");
    expect(sql).not.toContain("'applicant_data'");
  });

  it("requires the stored private hash and rate limits tracking attempts", () => {
    expect(sql).toContain("v_stored_hash is distinct from p_tracking_secret_hash");
    expect(sql).toContain("public_admission_track");
    expect(sql).toContain("interval '15 minutes'");
    expect(sql).toContain("v_recent_attempts >= 20");
    expect(sql).toContain("pg_advisory_xact_lock");
  });

  it("keeps tracking RPC unavailable to browser roles", () => {
    expect(sql).not.toContain("security definer");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });
});

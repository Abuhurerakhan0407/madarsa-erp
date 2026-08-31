import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260831043000_student_status_certificate_runtime.sql"), "utf8").toLowerCase();

describe("student status certificate runtime contract", () => {
  it("requires document issuance and file management permissions", () => {
    expect(sql).toContain("rp.permission_code='document.job.manage'");
    expect(sql).toContain("rp.permission_code='documents.file.manage'");
    expect(sql).toContain("rp.permission_code='documents.file.read'");
  });

  it("uses existing governed document primitives and immutable snapshots", () => {
    expect(sql).toContain("insert into public.document_generation_jobs");
    expect(sql).toContain("insert into public.documents");
    expect(sql).toContain("insert into public.issued_document_records");
    expect(sql).toContain("'content_snapshot',v_snapshot");
    expect(sql).toContain("state='superseded'");
  });

  it("keeps issue/read/verification RPCs server-only", () => {
    expect(sql.match(/from public,anon,authenticated/g)?.length).toBe(3);
    expect(sql.match(/to service_role/g)?.length).toBe(3);
  });

  it("public verification exposes only active explicitly verifiable documents", () => {
    expect(sql).toContain("d.visibility='public_verification'");
    expect(sql).toContain("idr.state='active'");
    expect(sql).toContain("d.status='active'");
  });
});

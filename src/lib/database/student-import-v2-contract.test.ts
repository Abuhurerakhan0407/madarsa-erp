import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260925183000_import_students_v2.sql"),
  "utf8"
).toLowerCase();

describe("student import v2 database contract", () => {
  it("keeps import server-only, permission-gated, and idempotent", () => {
    expect(sql).toContain("create or replace function public.import_students_batch_v2");
    expect(sql).toContain("student import permission denied");
    expect(sql).toContain("idempotency_key=p_request_key");
    expect(sql).toContain("'unchanged',true");
    expect(sql).toContain("revoke all on function public.import_students_batch_v2");
    expect(sql).toContain("to service_role");
    expect(sql).not.toContain("to authenticated");
  });

  it("uses governed student creation and blocks duplicate-review candidates", () => {
    expect(sql).toContain("public.create_student_direct");
    expect(sql).toContain("duplicate_review_required");
    expect(sql).toContain("'blocked'");
    expect(sql).toContain("'duplicate_review_required'");
  });

  it("reuses one guardian by normalized email or phone and refuses ambiguous matches", () => {
    expect(sql).toContain("pc.type='email'");
    expect(sql).toContain("pc.type='phone'");
    expect(sql).toContain("count(distinct gp.person_id)");
    expect(sql).toContain("guardian contacts match multiple records");
    expect(sql).toContain("'guardian_linked_existing'");
  });

  it("creates verified parent links without duplicating matching contact rows", () => {
    expect(sql).toContain("insert into public.person_relationships");
    expect(sql).toContain("on conflict(tenant_id,source_person_id,target_person_id,relationship_type)");
    expect(sql).toContain("not exists(");
    expect(sql).toContain("insert into public.person_contacts");
  });

  it("records item-level results, summary counts, and an import audit event", () => {
    expect(sql).toContain("student_bulk_operation_items");
    expect(sql).toContain("'guardian_linked'");
    expect(sql).toContain("'students.bulk.import'");
    expect(sql).toContain("'student_bulk_operation_job'");
  });
});

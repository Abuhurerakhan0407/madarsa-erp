import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260821133000_admission_student_conversion.sql"),
  "utf8"
).toLowerCase();

describe("admission student conversion migration", () => {
  it("keeps conversion server-only and non-definer", () => {
    expect(sql).toContain("function public.convert_admission_to_student");
    expect(sql).not.toContain("security definer");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });

  it("requires conversion, enrollment, profile, person, and branch authority", () => {
    expect(sql).toContain("admissions.application.convert");
    expect(sql).toContain("academics.enrollment.manage");
    expect(sql).toContain("students.profile.update");
    expect(sql).toContain("people.person.manage");
    expect(sql).toContain("membership_branch_scopes");
    expect(sql).toContain("count(distinct rp.permission_code) = 4");
  });

  it("converts the accepted application atomically into SIS records", () => {
    expect(sql).toContain("private.reserve_formatted_number");
    expect(sql).toContain("insert into public.persons");
    expect(sql).toContain("insert into public.student_profiles");
    expect(sql).toContain("insert into public.enrollments");
    expect(sql).toContain("insert into public.enrollment_events");
    expect(sql).toContain("state = 'enrolled'");
    expect(sql).toContain("status = 'completed'");
    expect(sql).toContain("insert into public.audit_events");
  });

  it("fails closed around numbering, workflow, and duplicate identity risk", () => {
    expect(sql).toContain("published student numbering required before conversion");
    expect(sql).toContain("pinned workflow conversion transition unavailable");
    expect(sql).toContain("duplicate_review_required");
    expect(sql).toContain("p_confirm_new_person");
    expect(sql).toContain("idempotent");
  });
});

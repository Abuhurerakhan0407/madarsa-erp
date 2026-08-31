import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../../supabase/migrations/20260831033000_student_id_card_batch_runtime.sql", import.meta.url), "utf8");

describe("bulk ID card runtime contract", () => {
  it("requires student read and document job permissions", () => {
    expect(migration).toContain("rp.permission_code = 'students.profile.read'");
    expect(migration).toContain("rp.permission_code = 'document.job.manage'");
  });

  it("enforces branch scope and active academic selection", () => {
    expect(migration).toContain("public.membership_branch_scopes");
    expect(migration).toContain("active academic session is required");
    expect(migration).toContain("active class/group is required");
  });

  it("caps selections and keeps browser execution closed", () => {
    expect(migration).toContain("cardinality(p_person_ids) > 250");
    expect(migration).toContain("revoke all on function public.get_student_id_card_batch");
    expect(migration).toContain("grant execute on function public.get_student_id_card_batch");
    expect(migration).toContain("to service_role");
    expect(migration).not.toMatch(/grant\s+execute[^;]+to\s+(anon|authenticated)/i);
  });
});

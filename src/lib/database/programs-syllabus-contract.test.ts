import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const foundation = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260903043000_phase3_programs_syllabus_foundation.sql"),
  "utf8"
).toLowerCase();
const runtime = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260903044500_phase3_programs_syllabus_runtime.sql"),
  "utf8"
).toLowerCase();

describe("Programs & Syllabus database contract", () => {
  it("models exactly one group or student teaching target", () => {
    expect(foundation).toContain("curriculum_teaching_assignments_target_check");
    expect(foundation).toContain("(group_id is not null)::int + (student_person_id is not null)::int = 1");
  });

  it("adds governed curriculum progress permissions and RLS", () => {
    expect(foundation).toContain("learning.progress.read");
    expect(foundation).toContain("learning.progress.manage");
    expect(foundation).toContain("alter table public.student_curriculum_progress enable row level security");
    expect(foundation).toContain("private.has_permission(tenant_id, 'learning.progress.read', null)");
  });

  it("keeps mutation RPCs service-role only", () => {
    for (const name of [
      "create_teaching_program_v1",
      "add_program_level_v1",
      "add_curriculum_component_v1",
      "add_curriculum_unit_v1",
      "publish_program_curriculum_v1",
      "assign_curriculum_teaching_v1",
      "record_student_curriculum_progress_v1"
    ]) {
      expect(runtime).toContain(`revoke all on function public.${name}`);
      expect(runtime).toContain(`grant execute on function public.${name}`);
    }
    expect(runtime).toContain("to service_role;");
  });

  it("creates editable drafts without rewriting published curriculum", () => {
    expect(runtime).toContain("ensure_program_curriculum_draft_v1");
    expect(runtime).toContain("where cv.tenant_id=p_tenant_id and cv.program_id=p_program_id and cv.state='published'");
    expect(runtime).toContain("coalesce(max(cv.version),0)+1");
  });

  it("publishes by superseding the previous published version", () => {
    expect(runtime).toContain("update public.curriculum_versions set state='superseded'");
    expect(runtime).toContain("update public.curriculum_versions set state='published',published_at=now()");
    expect(runtime).toContain("every curriculum component requires at least one unit before publishing");
  });

  it("validates assignment scope and curriculum progress before writes", () => {
    expect(runtime).toContain("select exactly one group or student target");
    expect(runtime).toContain("published curriculum item is required");
    expect(runtime).toContain("student target is not actively enrolled in this program");
    expect(runtime).toContain("curriculum unit is outside this assignment");
    expect(runtime).toContain("student is outside this teaching assignment");
  });

  it("records auditable mutations", () => {
    expect(runtime).toContain("academics.program.create");
    expect(runtime).toContain("learning.curriculum.component.create");
    expect(runtime).toContain("learning.curriculum.unit.create");
    expect(runtime).toContain("learning.curriculum.publish");
    expect(runtime).toContain("learning.curriculum.assign");
    expect(runtime).toContain("learning.curriculum.progress.record");
  });
});

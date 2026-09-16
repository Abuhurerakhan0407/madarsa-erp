import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Daily Ops Qur'an teacher assignment scope", () => {
  const migration = read("supabase/migrations/20260917024500_rescue_daily_ops_quran_teacher_scope.sql");

  it("derives teacher identity from verified employee linkage and never trusts caller teacher IDs", () => {
    expect(migration).toContain("quran_operator_teacher_person_v1");
    expect(migration).toContain("l.link_type='employee'");
    expect(migration).toContain("l.status='verified'");
    expect(migration).toContain("quran_operator_can_access_student_v1");
    expect(read("src/app/api/quran/daily/route.ts")).not.toContain("p_teacher_person_id");
    expect(read("src/app/api/quran/record/route.ts")).not.toContain("p_teacher_person_id");
  });

  it("scopes groups through existing primary-teacher, curriculum, or timetable assignments", () => {
    expect(migration).toContain("g.primary_teacher_person_id=v_teacher");
    expect(migration).toContain("c.teacher_person_id=v_teacher");
    expect(migration).toContain("te.teacher_person_id=v_teacher");
    expect(migration).toContain("Quran group assignment permission denied");
  });


describe("Daily Ops Qur'an scoped call surfaces", () => {
  it("uses scoped read and write RPCs", () => {
    expect(read("src/lib/quran/daily-register.ts")).toContain("get_quran_hifz_daily_register_v2");
    expect(read("src/lib/quran/detail.ts")).toContain("get_quran_student_detail_scoped_v1");
    expect(read("src/lib/quran/detail.ts")).toContain("get_quran_juz_wall_scoped_v1");
    expect(read("src/lib/quran/detail.ts")).toContain("get_quran_revision_queue_v2");
    expect(read("src/app/api/quran/daily/route.ts")).toContain("record_quran_hifz_daily_quick_v2");
    expect(read("src/app/api/quran/record/route.ts")).toContain("record_quran_hifz_attempt_scoped_v1");
    expect(read("src/app/api/quran/correct/route.ts")).toContain("correct_quran_recitation_attempt_scoped_v1");
  });

  it("keeps supervisory access explicit instead of broadening all teachers", () => {
    expect(migration).toContain("learning.recitation.correct");
    expect(migration).toContain("settings.roles.manage");
    expect(migration).toContain("hr.employee.manage");
    expect(migration).toContain("academics.structure.manage");
  });
});
});

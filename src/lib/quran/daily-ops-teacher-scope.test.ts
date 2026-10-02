import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8").toLowerCase();
const migration = read("supabase/migrations/20260917024500_rescue_daily_ops_quran_teacher_scope.sql");
const register = read("src/lib/quran/daily-register.ts");
const detail = read("src/lib/quran/detail.ts");
const dailyApi = read("src/app/api/quran/daily/route.ts");
const legacyApi = read("src/app/api/quran/record/route.ts");
const correctionApi = read("src/app/api/quran/correct/route.ts");

describe("Daily Ops Qur'an teacher assignment scope", () => {
  it("derives a verified active employee identity and reuses real teaching assignments", () => {
    expect(migration).toContain("identity_person_links");
    expect(migration).toContain("link_type='employee'");
    expect(migration).toContain("primary_teacher_person_id=v_teacher");
    expect(migration).toContain("curriculum_teaching_assignments");
    expect(migration).toContain("timetable_entries");
  });
  it("guards register, student detail, revision queue, recording and correction", () => {
    expect(register).toContain("get_quran_hifz_daily_register_v2");
    expect(detail).toContain("get_quran_student_detail_scoped_v1");
    expect(detail).toContain("get_quran_juz_wall_scoped_v1");
    expect(detail).toContain("get_quran_revision_queue_v2");
    expect(dailyApi).toContain("record_quran_hifz_daily_quick_v2");
    expect(legacyApi).toContain("record_quran_hifz_attempt_scoped_v1");
    expect(correctionApi).toContain("correct_quran_recitation_attempt_scoped_v1");
  });
  it("does not trust a client-supplied teacher id", () => {
    expect(dailyApi).not.toContain("p_teacher_person_id");
    expect(legacyApi).not.toContain("p_teacher_person_id");
    expect(migration).toContain("quran_operator_teacher_person_v1");
  });
});

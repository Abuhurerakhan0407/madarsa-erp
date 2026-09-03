import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function migration(name: string) {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8").toLowerCase();
}

const foundation = migration("20260903070500_phase4_quran_register_foundation.sql");
const readModel = migration("20260903071000_phase4_quran_daily_register_read.sql");
const quickRuntime = migration("20260903071500_phase4_quran_daily_quick_runtime.sql");
const asOfDate = migration("20260903072000_phase4_quran_register_as_of_date.sql");

describe("Phase 4 Qur'an & Hifz database contracts", () => {
  it("keeps target and roster status tables tenant scoped and RLS protected", () => {
    expect(foundation).toContain("create table public.quran_student_targets");
    expect(foundation).toContain("create table public.quran_daily_roster_statuses");
    expect(foundation).toContain("alter table public.quran_student_targets enable row level security");
    expect(foundation).toContain("alter table public.quran_daily_roster_statuses enable row level security");
    expect(foundation).toContain("revoke all on public.quran_student_targets from public,anon,authenticated");
    expect(foundation).toContain("revoke all on public.quran_daily_roster_statuses from public,anon,authenticated");
  });

  it("exposes read and mutation RPCs only through the server service role", () => {
    expect(readModel).toContain("revoke all on function public.get_quran_hifz_daily_register_v1");
    expect(readModel).toContain("grant execute on function public.get_quran_hifz_daily_register_v1");
    expect(readModel).toContain("to service_role");
    expect(quickRuntime).toContain("revoke all on function public.record_quran_hifz_daily_quick_v1");
    expect(quickRuntime).toContain("grant execute on function public.record_quran_hifz_daily_quick_v1");
    expect(quickRuntime).toContain("to service_role");
    expect(readModel).not.toContain("security definer");
    expect(quickRuntime).not.toContain("security definer");
    expect(asOfDate).not.toContain("security definer");
  });

  it("reuses the proven idempotent recitation engine for real lesson outcomes", () => {
    expect(quickRuntime).toContain("public.record_quran_hifz_attempt_idempotent");
    expect(quickRuntime).toContain("'pass'");
    expect(quickRuntime).toContain("'repeat'");
    expect(quickRuntime).toContain("'needs_support'");
    expect(quickRuntime).toContain("'partial'");
  });

  it("stores absent and no-lesson as roster statuses rather than fake recitation attempts", () => {
    expect(foundation).toContain("status in ('absent','no_lesson')");
    expect(quickRuntime).toContain("if v_action in ('absent','no_lesson') then");
    expect(quickRuntime).toContain("insert into public.quran_daily_roster_statuses");
    expect(quickRuntime).toContain("'recorded',false");
  });

  it("preserves existing Qur'an history and derives the class roster from active enrollment", () => {
    expect(readModel).toContain("public.quran_effective_recitation_attempts_v1");
    expect(readModel).toContain("public.revision_obligations");
    expect(readModel).toContain("public.enrollments");
    expect(readModel).toContain("public.recitation_mistakes");
    expect(readModel).toContain("memorized_juz");
    expect(readModel).toContain("monthly_average");
  });

  it("keeps backdated registers truthful to the selected lesson date", () => {
    expect(asOfDate).toContain("rs.session_date<=v_date");
    expect(asOfDate).toContain("order by rs.session_date desc");
    expect(asOfDate).toContain("t.assigned_on<=v_date");
    expect(asOfDate).toContain("rs.session_date>=date_trunc('month',v_date)::date and rs.session_date<=v_date");
    expect(asOfDate).toContain("revoke all on function public.get_quran_hifz_daily_register_v1");
    expect(asOfDate).toContain("to service_role");
  });

  it("prevents revision due dates from preceding the lesson date in the database runtime", () => {
    expect(quickRuntime).toContain("p_revision_due_on<p_session_date");
    expect(quickRuntime).toContain("revision due date cannot be before the lesson date");
  });
});

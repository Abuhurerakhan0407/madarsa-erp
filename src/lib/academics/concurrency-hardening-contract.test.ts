import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";
const sql=readFileSync(resolve(process.cwd(),"supabase/migrations/20260912044500_academic_concurrency_serialization.sql"),"utf8");

describe("academic concurrency serialization",()=>{
 it("locks the entire timetable conflict-check/write boundary",()=>{expect(sql).toContain("mutate_academics_timetable_v1_unlocked");expect(sql).toContain("academics_schedule_mutation:%s:%s");expect(sql.indexOf("pg_advisory_xact_lock")).toBeLessThan(sql.indexOf("return public.mutate_academics_timetable_v1_unlocked"))});
 it("locks curriculum draft creation before the legacy max-version helper executes",()=>{expect(sql).toContain("ensure_program_curriculum_draft_v1_unlocked");expect(sql).toContain("curriculum_draft:%s:%s");const draftBlock=sql.slice(sql.indexOf("create or replace function private.ensure_program_curriculum_draft_v1("));expect(draftBlock.indexOf("pg_advisory_xact_lock")).toBeLessThan(draftBlock.indexOf("return private.ensure_program_curriculum_draft_v1_unlocked"))});
 it("keeps public timetable mutation service-role only",()=>{expect(sql).toMatch(/revoke all on function public\.mutate_academics_timetable_v1\([^;]+from public,anon,authenticated/i);expect(sql).toMatch(/grant execute on function public\.mutate_academics_timetable_v1\([^;]+to service_role/i)});
 it("does not expose the private curriculum helper to application roles",()=>{expect(sql).toMatch(/revoke all on function private\.ensure_program_curriculum_draft_v1\([^;]+from public,anon,authenticated,service_role/i)});
});

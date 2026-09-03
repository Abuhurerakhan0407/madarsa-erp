import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function migration(name:string){return readFileSync(resolve(process.cwd(),"supabase/migrations",name),"utf8").toLowerCase();}
const foundation=migration("20260903080000_phase5_academics_timetable_foundation.sql");
const readModel=migration("20260903081000_phase5_academics_timetable_read.sql");
const mutations=migration("20260903082000_phase5_academics_timetable_mutations.sql");
const students=migration("20260903082500_phase5_academics_students_read.sql");
const attachments=migration("20260903082700_phase5_academic_attachment_staging.sql");

describe("Phase 5 Academics & Timetable database contracts",()=>{
  it("adds tenant-scoped schedule exceptions with RLS",()=>{
    expect(foundation).toContain("create table if not exists public.academic_schedule_exceptions");
    expect(foundation).toContain("foreign key (tenant_id,timetable_entry_id)");
    expect(foundation).toContain("alter table public.academic_schedule_exceptions enable row level security");
    expect(foundation).toContain("force row level security");
    expect(foundation).toContain("revoke all on public.academic_schedule_exceptions from public,anon,authenticated");
  });

  it("keeps homework targeting explicit and calendar attendance semantics explicit",()=>{
    expect(foundation).toContain("num_nonnulls(group_id,student_person_id)=1");
    expect(foundation).toContain("parent_visible boolean");
    expect(foundation).toContain("student_visible boolean");
    expect(foundation).toContain("priority text");
    expect(foundation).toContain("affects_attendance");
  });

  it("builds the selected-day schedule from base entries plus exceptions and closures",()=>{
    expect(readModel).toContain("base_occurrence");
    expect(readModel).toContain("rescheduled_occurrence");
    expect(readModel).toContain("academic_schedule_exceptions");
    expect(readModel).toContain("event_type in ('holiday','closure')");
    expect(readModel).toContain("affects_attendance");
  });

  it("governs timetable mutations with existing academic permissions and conflict checks",()=>{
    expect(mutations).toContain("academics.timetable.manage");
    expect(mutations).toContain("academics.homework.manage");
    expect(mutations).toContain("academics.structure.manage");
    expect(mutations).toContain("timetable group conflict detected");
    expect(mutations).toContain("timetable teacher conflict detected");
    expect(mutations).toContain("timetable room conflict detected");
    expect(mutations).not.toContain("security definer");
  });

  it("derives the student picker from active enrollment rather than browser tenant input",()=>{
    expect(students).toContain("public.enrollments");
    expect(students).toContain("e.status='active'");
    expect(students).toContain("p_tenant_id");
    expect(students).toContain("p_branch_id");
  });

  it("stages private attachments with digest-only tokens and atomic record binding",()=>{
    expect(attachments).toContain("create table if not exists public.academic_attachment_uploads");
    expect(attachments).toContain("token_digest text not null unique");
    expect(attachments).toContain("consumed_at");
    expect(attachments).toContain("expires_at");
    expect(attachments).toContain("revoke all on public.academic_attachment_uploads from public,anon,authenticated");
    expect(attachments).toContain("for update");
    expect(attachments).toContain("mutate_academics_timetable_v1");
    expect(attachments).toContain("attachment_bound");
    expect(attachments).not.toContain("security definer");
  });

  it("keeps all new public RPC entrypoints service-role-only",()=>{
    for(const source of [readModel,mutations,students,attachments]){
      expect(source).toContain("revoke all on function public.");
      expect(source).toContain("to service_role");
    }
  });
});

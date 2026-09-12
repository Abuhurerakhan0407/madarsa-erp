import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const migration=readFileSync('supabase/migrations/20260912194000_master_audit_teacher_roster_hardening.sql','utf8').toLowerCase();
const runtime=readFileSync('src/lib/students/my-students.ts','utf8');
const page=readFileSync('src/app/[locale]/my-students/page.tsx','utf8');

describe('master audit teacher roster hardening',()=>{
 it('excludes expired and future timetable assignments for the institution-local date',()=>{
  expect(migration).toContain('v_date date:=coalesce(p_as_of_date,public.institution_local_date(p_tenant_id))');
  expect(migration).toContain('e.effective_from<=v_date');
  expect(migration).toContain('(e.effective_to is null or e.effective_to>=v_date)');
  expect(migration).toContain("e.status='active'");
 });
 it('preserves multiple current student-group assignments instead of overwriting by student id',()=>{
  expect(migration).toContain('select distinct e.student_person_id,e.group_id');
  expect(migration).toContain("'group_id',r.group_id");
  expect(runtime).toContain('groupId:number');
  expect(runtime).not.toContain('new Map');
  expect(page).toContain('key={`${s.personId}-${s.groupId}`}');
 });
 it('uses bounded server-side search and pagination for datasets larger than client row caps',()=>{
  expect(migration).toContain('least(greatest(coalesce(p_page_size,40),1),100)');
  expect(migration).toContain('limit v_page_size offset (v_page-1)*v_page_size');
  expect(migration).toContain('timetable_entries_teacher_effective_idx');
  expect(migration).toContain('enrollments_group_active_roster_idx');
  expect(runtime).toContain('admin.rpc("get_teacher_student_roster_v1"');
  expect(runtime).toContain('p_search:search,p_page:page,p_page_size:pageSize');
  expect(runtime).not.toContain('admin.from("timetable_entries")');
  expect(runtime).not.toContain('admin.from("enrollments")');
 });
});

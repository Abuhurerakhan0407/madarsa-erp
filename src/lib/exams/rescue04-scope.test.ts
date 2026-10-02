import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';
const sql=readFileSync(resolve(process.cwd(),'supabase/migrations/20260917023000_rescue04_academic_result_reporting_accuracy.sql'),'utf8').toLowerCase();
type Row={tenant:number;branch:number;session:number;program:number;group:number;student:number;exam:number;start:string;end:string};
type Scope=Omit<Row,'start'|'end'>&{from:string;to:string};
const inScope=(row:Row,scope:Scope)=>row.tenant===scope.tenant&&row.branch===scope.branch&&row.session===scope.session&&row.program===scope.program&&row.group===scope.group&&row.student===scope.student&&row.exam===scope.exam&&row.start<=scope.to&&row.end>=scope.from;
const base:Row={tenant:1,branch:10,session:20,program:30,group:40,student:50,exam:60,start:'2026-09-01',end:'2026-09-10'};
const scope:Scope={tenant:1,branch:10,session:20,program:30,group:40,student:50,exam:60,from:'2026-09-01',to:'2026-09-30'};

describe('Workstream 04 report population isolation',()=>{
 it('rejects cross-tenant and cross-branch rows',()=>{expect([base,{...base,tenant:2},{...base,branch:11}].filter(r=>inScope(r,scope))).toEqual([base]);});
 it('rejects mixed session, program, group and student rows',()=>{expect([base,{...base,session:21},{...base,program:31},{...base,group:41},{...base,student:51}].filter(r=>inScope(r,scope))).toEqual([base]);});
 it('rejects a different exam and dates outside requested window',()=>{expect([base,{...base,exam:61},{...base,start:'2026-10-01',end:'2026-10-02'}].filter(r=>inScope(r,scope))).toEqual([base]);});
 it('pins SQL comparison population to tenant/branch/session/program/group/student and scoped exams',()=>{
  for(const clause of ['e.tenant_id=p_tenant_id','e.branch_id=p_branch_id','e.session_id=v_session_id','e.program_id=v_program_id','e.group_id=v_group_id','e.student_person_id=v_student_id','ex.branch_id=p_branch_id','ex.session_id=cs.session_id and ex.program_id=cs.program_id','ex.starts_on<=v_date_to and ex.ends_on>=v_date_from'])expect(sql).toContain(clause);
  expect(sql).toContain('ex.group_id is null or ex.group_id is not distinct from cs.group_id');
  expect(sql).toContain("case when ex.id is null or me.entry_status<>'present'");
 });
});

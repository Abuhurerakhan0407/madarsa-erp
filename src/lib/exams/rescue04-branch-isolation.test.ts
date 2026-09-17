import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const sql=readFileSync(resolve(process.cwd(),'supabase/migrations/20260917181000_academic_domain_provenance_reconciliation.sql'),'utf8').toLowerCase();
const reviewedSql=readFileSync(resolve(process.cwd(),'supabase/migrations/20260917023000_rescue04_academic_result_reporting_accuracy.sql'),'utf8').toLowerCase();
type Scope={tenant:number;branch:number;session?:number;program?:number;group?:number;student?:number;from:string;to:string};
type Assignment={id:number;tenant:number;session:number;program:number;group:number|null;student:number|null;startsOn:string;endsOn:string|null;sourceBranch:number|null};
type Enrollment={tenant:number;branch:number;student:number;session:number;program:number;group:number|null;startsOn:string;endsOn:string|null;status:string};
type Progress={id:number;tenant:number;student:number;assignmentId:number|null;occurred:string;sourceBranch:number|null;value:number;state:string};
const day=(value:string)=>value.slice(0,10);
const activeAt=(e:Enrollment,on:string)=>e.status!=='cancelled'&&e.startsOn<=on&&(e.endsOn===null||e.endsOn>=on);
function oldProgramProgressIncludes(progress:Progress,assignment:Assignment|null,currentBranchEnrollment:Enrollment|null,scope:Scope){
 if(progress.tenant!==scope.tenant||day(progress.occurred)<scope.from||day(progress.occurred)>scope.to)return false;
 const session=assignment?.session??currentBranchEnrollment?.session,program=assignment?.program??currentBranchEnrollment?.program,group=assignment?.group??currentBranchEnrollment?.group;
 return (scope.session===undefined||session===scope.session)&&(scope.program===undefined||program===scope.program)&&(scope.group===undefined||group===scope.group)&&(scope.student===undefined||progress.student===scope.student);
}
function fixedProgramProgressIncludes(progress:Progress,assignments:Assignment[],enrollments:Enrollment[],scope:Scope){
 if(progress.tenant!==scope.tenant||progress.sourceBranch!==scope.branch||day(progress.occurred)<scope.from||day(progress.occurred)>scope.to)return false;
 const a=assignments.find(row=>row.tenant===progress.tenant&&row.id===progress.assignmentId);if(!a||a.sourceBranch!==scope.branch)return false;
 const on=day(progress.occurred);if(a.startsOn>on||(a.endsOn!==null&&a.endsOn<on))return false;
 const e=enrollments.find(row=>row.tenant===scope.tenant&&row.branch===scope.branch&&row.student===progress.student&&row.session===a.session&&row.program===a.program&&activeAt(row,on)&&(a.group===null||row.group===a.group));if(!e)return false;
 if(!((a.student!==null&&a.student===progress.student)||(a.group!==null&&e.group===a.group)))return false;
 return (scope.session===undefined||a.session===scope.session)&&(scope.program===undefined||a.program===scope.program)&&(scope.group===undefined||e.group===scope.group)&&(scope.student===undefined||progress.student===scope.student);
}
const scope:Scope={tenant:1,branch:10,session:30,program:40,from:'2026-09-01',to:'2026-09-30'};
const branchAEnrollment:Enrollment={tenant:1,branch:10,student:100,session:30,program:40,group:51,startsOn:'2026-09-11',endsOn:null,status:'active'};
const branchBEnrollment:Enrollment={tenant:1,branch:20,student:100,session:30,program:40,group:50,startsOn:'2026-01-01',endsOn:'2026-09-10',status:'transferred'};
const branchAAssignment:Assignment={id:501,tenant:1,session:30,program:40,group:51,student:null,startsOn:'2026-09-11',endsOn:null,sourceBranch:10};
const branchBAssignment:Assignment={id:500,tenant:1,session:30,program:40,group:50,student:null,startsOn:'2026-01-01',endsOn:'2026-09-10',sourceBranch:20};
const branchAProgress:Progress={id:901,tenant:1,student:100,assignmentId:501,occurred:'2026-09-12T08:00:00Z',sourceBranch:10,value:80,state:'in_progress'};
const branchBProgress:Progress={id:900,tenant:1,student:100,assignmentId:500,occurred:'2026-09-05T08:00:00Z',sourceBranch:20,value:70,state:'in_progress'};

describe('Workstream 04 program_progress branch provenance P0',()=>{
 it('captures the exact reviewed-SQL vulnerable join path before the forward fix',()=>{expect(reviewedSql).toContain('left join public.curriculum_teaching_assignments ta on ta.tenant_id=scp.tenant_id and ta.id=scp.teaching_assignment_id');expect(reviewedSql).toContain("left join lateral(select e.* from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=scp.student_person_id and e.status='active'");expect(reviewedSql).toContain('coalesce(ta.session_id,e.session_id)=v_session_id');expect(reviewedSql).toContain('coalesce(ta.program_id,e.program_id)=v_program_id');expect(reviewedSql).toContain('coalesce(ta.group_id,e.group_id)=v_group_id');});
 it('reproduces the old cross-branch leak through ta-first COALESCE',()=>{expect(oldProgramProgressIncludes(branchBProgress,branchBAssignment,branchAEnrollment,scope)).toBe(true);});
 it('A includes Branch A progress',()=>{expect(fixedProgramProgressIncludes(branchAProgress,[branchAAssignment],[branchAEnrollment],scope)).toBe(true);});
 it('B excludes same-tenant Branch B progress',()=>{expect(fixedProgramProgressIncludes(branchBProgress,[branchBAssignment],[branchBEnrollment,branchAEnrollment],scope)).toBe(false);});
 it('C does not reclassify transferred historical Branch B progress as Branch A',()=>{expect(fixedProgramProgressIncludes(branchBProgress,[branchBAssignment],[branchBEnrollment,branchAEnrollment],scope)).toBe(false);});
 it('D excludes cross-branch progress even when the academic session is shared',()=>{expect(branchBAssignment.session).toBe(scope.session);expect(fixedProgramProgressIncludes(branchBProgress,[branchBAssignment],[branchBEnrollment],scope)).toBe(false);});
 it('E excludes cross-branch progress even when the program is shared',()=>{expect(branchBAssignment.program).toBe(scope.program);expect(fixedProgramProgressIncludes(branchBProgress,[branchBAssignment],[branchBEnrollment],scope)).toBe(false);});
 it('F excludes same group-like context from another branch',()=>{const b={...branchBAssignment,group:52};const p={...branchBProgress,assignmentId:b.id};const be={...branchBEnrollment,group:52};expect(fixedProgramProgressIncludes(p,[b],[be],scope)).toBe(false);});
 it('G preserves correctly scoped Branch A session/program/group data',()=>{const groupScope={...scope,group:51,student:100};expect(fixedProgramProgressIncludes(branchAProgress,[branchAAssignment],[branchAEnrollment],groupScope)).toBe(true);});
 it('H preserves date range filtering',()=>{expect(fixedProgramProgressIncludes({...branchAProgress,occurred:'2026-10-01T08:00:00Z'},[branchAAssignment],[branchAEnrollment],scope)).toBe(false);});
 it('I excludes cross-tenant rows',()=>{expect(fixedProgramProgressIncludes({...branchAProgress,tenant:2},[branchAAssignment],[branchAEnrollment],scope)).toBe(false);});
 it('J fails closed when progress or assignment branch provenance is ambiguous',()=>{expect(fixedProgramProgressIncludes({...branchAProgress,sourceBranch:null},[branchAAssignment],[branchAEnrollment],scope)).toBe(false);expect(fixedProgramProgressIncludes(branchAProgress,[{...branchAAssignment,sourceBranch:null}],[branchAEnrollment],scope)).toBe(false);expect(fixedProgramProgressIncludes({...branchAProgress,assignmentId:null},[branchAAssignment],[branchAEnrollment],scope)).toBe(false);});
 it('preserves Branch A data accuracy without duplicate joins',()=>{const e2={...branchAEnrollment,student:101};const p2={...branchAProgress,id:902,student:101,value:100,state:'completed'};const rows=[branchAProgress,p2,branchBProgress].filter(p=>fixedProgramProgressIncludes(p,[branchAAssignment,branchBAssignment],[branchAEnrollment,e2,branchBEnrollment],scope));expect(rows).toHaveLength(2);expect(new Set(rows.map(r=>r.student)).size).toBe(2);expect(rows.reduce((n,r)=>n+r.value,0)/rows.length).toBe(90);expect(rows.filter(r=>r.state==='completed')).toHaveLength(1);expect(rows.filter(r=>r.state==='completed').length/rows.length*100).toBe(50);});
 it('hardens SQL with immutable domain provenance plus enrollment-at-occurrence',()=>{for(const clause of ["ta.source_branch_id=p_branch_id","scp.source_branch_id=p_branch_id","scp.source_branch_id=ta.source_branch_id","e.branch_id=p_branch_id","e.starts_on<=scp.occurred_at::date","e.ends_on is null or e.ends_on>=scp.occurred_at::date","ta.starts_on<=scp.occurred_at::date","ta.ends_on is null or ta.ends_on>=scp.occurred_at::date"])expect(sql).toContain(clause);expect(sql).toContain("e.status<>'cancelled'");expect(sql).toContain('join public.curriculum_teaching_assignments ta');expect(sql).not.toContain("aa.action='learning.curriculum.assign'");expect(sql).not.toContain("pa.action='learning.curriculum.progress.record'");expect(sql).not.toContain('coalesce(ta.session_id,e.session_id)=v_session_id');});
 it('also hardens comparison progress and consumes Chat 03 Quran provenance while keeping exam branch joins',()=>{expect(sql).toContain("progress_events");expect(sql).toContain('public.quran_revision_obligation_in_branch_v1(r.id,p_tenant_id,p_branch_id,st.student_person_id)');expect(sql).not.toContain("after_state->>'revision_obligation_id'=r.id::text");expect(sql).not.toContain("after_state->>'revision_created'=r.id::text");expect(sql).toContain('join public.exam_series ex on ex.tenant_id=es.tenant_id and ex.id=es.exam_series_id and ex.branch_id=p_branch_id');expect(sql).toContain('rs.branch_id=p_branch_id');});
});

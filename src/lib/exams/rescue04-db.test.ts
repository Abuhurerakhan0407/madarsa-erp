import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const sql=readFileSync(resolve(process.cwd(),'supabase/migrations/20260917023000_rescue04_academic_result_reporting_accuracy.sql'),'utf8').toLowerCase();

describe('Workstream 04 academic accuracy migration',()=>{
 it('uses the selected grading scale instead of hard-coded grade thresholds',()=>{
  expect(sql).toContain('resolve_exam_grade_v1');
  expect(sql).toContain('v_exam.grading_scale_version_id');
  expect(sql).toContain('v_grading.rounding_mode');
  expect(sql).toContain("v_rules->'bands'");
  expect(sql).not.toContain("when v_pct>=90 then 'a+'");
 });
 it('preserves non-present result states and excludes exempt subjects from the denominator',()=>{
  expect(sql).toContain("me.entry_status='exempt' then 0 else x.maximum_marks");
  expect(sql).toContain("when v_withheld>0 then 'withheld'");
  expect(sql).toContain("when v_incomplete>0 then 'incomplete'");
  expect(sql).toContain("when v_present=0 and v_exempt>0 then 'exempt'");
 });
 it('computes ranks only when ranking is enabled',()=>{
  expect(sql).toContain('if v_exam.ranking_enabled then');
  expect(sql).toContain('rank() over(order by rs.percentage desc)');
  expect(sql).toContain('set rank_value=ranked.rank_value');
 });
 it('scopes comparison data to matching branch, date, session, program, group and enrollment',()=>{
  expect(sql).toContain("case when ex.id is null or me.entry_status<>'present'");
  expect(sql).toContain('ex.branch_id=p_branch_id');
  expect(sql).toContain('ex.starts_on<=v_date_to and ex.ends_on>=v_date_from');
  expect(sql).toContain('ex.session_id=cs.session_id and ex.program_id=cs.program_id');
  expect(sql).toContain('ae.session_id=cs.session_id and ae.program_id=cs.program_id');
  expect(sql).toContain('ta.session_id=cs.session_id and ta.program_id=cs.program_id');
 });
});

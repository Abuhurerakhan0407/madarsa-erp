import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';
import {getExamActionAvailability} from './state';
const read=(p:string)=>readFileSync(resolve(process.cwd(),p),'utf8').toLowerCase();
const schema=read('database/contracts/phase8_assessment.sql');
const create=read('supabase/migrations/20260903120000_client_v2_phase8_exams_results_v2.sql');
const marks=read('supabase/migrations/20260830220002_exams_mark_governance.sql');
const calc=read('supabase/migrations/20260917023000_rescue04_academic_result_reporting_accuracy.sql');
const publication=read('supabase/migrations/20260830220004_exams_result_publication.sql');
const states=['draft','scheduled','timetable_published','marks_open','marks_locked','results_approved','results_published','archived'];

describe('Workstream 04 implemented exam state machine',()=>{
 it('keeps the documented schema state vocabulary intact',()=>{for(const state of states)expect(schema).toContain(`'${state}'`);});
 it('documents current V2 creation as direct marks_open',()=>{expect(create).toContain("p_ends_on,'marks_open'");expect(create).toContain("'state','marks_open'");});
 it('accepts marks only while marks are open',()=>{expect(marks).toContain("es.state='marks_open'");});
 it('calculates only from marks_open or marks_locked and locks afterward',()=>{expect(calc).toContain("v_exam.state not in ('marks_open','marks_locked')");expect(calc).toContain("set state='marks_locked'");});
 it('approves calculated runs then publishes approved runs',()=>{expect(publication).toContain("rr.state='calculated'");expect(publication).toContain("set state='results_approved'");expect(publication).toContain("rr.state='approved'");expect(publication).toContain("set state='results_published'");});
 it('reopens governed pre-publication results through moderation only',()=>{expect(marks).toContain("v_series.state in ('results_published','archived')");expect(marks).toContain("v_series.state in ('marks_locked','results_approved')");expect(marks).toContain("set state='marks_open'");});
 it('offers no mutation action for archived state',()=>{const a=getExamActionAvailability({state:'archived',resultState:'approved',canRead:true,canEnter:true,canModerate:true,canApprove:true,canPublish:true,marksComplete:true,analysisAvailable:true});expect(a).toMatchObject({enterMarks:false,moderateMarks:false,calculate:false,approve:false,publish:false});});
 it('does not surface invalid approval or publication transitions',()=>{const open=getExamActionAvailability({state:'marks_open',resultState:'calculated',canRead:true,canEnter:true,canModerate:true,canApprove:true,canPublish:true,marksComplete:true,analysisAvailable:true});expect(open.approve).toBe(false);expect(open.publish).toBe(false);const locked=getExamActionAvailability({state:'marks_locked',resultState:'approved',canRead:true,canEnter:true,canModerate:true,canApprove:true,canPublish:true,marksComplete:true,analysisAvailable:true});expect(locked.publish).toBe(false);});
});

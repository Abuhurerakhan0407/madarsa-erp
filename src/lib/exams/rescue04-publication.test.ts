import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';
const read=(p:string)=>readFileSync(resolve(process.cwd(),p),'utf8').toLowerCase();
const publication=read('supabase/migrations/20260830220004_exams_result_publication.sql');
const reportCard=read('supabase/migrations/20260917023000_rescue04_academic_result_reporting_accuracy.sql');
const pdfRoute=read('src/app/api/exams/report-card/[personId]/pdf/route.ts');
type Snap={tenant:number;student:number;exam:number;state:string;publishedAt:string;id:number};
function selectPublished(rows:Snap[],tenant:number,student:number,exam:number){return rows.filter(r=>r.tenant===tenant&&r.student===student&&r.exam===exam&&r.state==='published').sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||b.id-a.id)[0]??null;}

describe('Workstream 04 publication snapshot contracts',()=>{
 it('selects only latest published snapshot for requested tenant/student/exam',()=>{const rows:Snap[]=[{tenant:1,student:7,exam:9,state:'published',publishedAt:'2026-09-10T00:00:00Z',id:1},{tenant:1,student:7,exam:9,state:'published',publishedAt:'2026-09-11T00:00:00Z',id:2},{tenant:1,student:7,exam:10,state:'published',publishedAt:'2026-09-12T00:00:00Z',id:3},{tenant:2,student:7,exam:9,state:'published',publishedAt:'2026-09-13T00:00:00Z',id:4}];expect(selectPublished(rows,1,7,9)?.id).toBe(2);});
 it('publishes only snapshots belonging to selected approved result run',()=>{expect(publication).toContain("rr.state='approved'");expect(publication).toContain("where tenant_id=p_tenant_id and result_run_id=v_run");expect(publication).toContain("result_snapshot_id=v_snapshot.id");});
 it('report card reads published snapshot from requested exam and tenant',()=>{expect(reportCard).toContain("rr.exam_series_id=p_exam_series_id and rs.state='published'");expect(reportCard).toContain("where rs.tenant_id=p_tenant_id and rs.id=v_snapshot");expect(reportCard).toContain("join public.academic_sessions sess");});
 it('requires issued verification before PDF generation',()=>{expect(pdfRoute).toContain("!card||!card.issue?.verificationcode");expect(pdfRoute).toContain('published report card is not available');});
});

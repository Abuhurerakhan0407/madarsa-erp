import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';
const read=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8');

describe('Workstream 04 academic UI contracts',()=>{
 it('derives workflow actions from one state helper',()=>{
  const hub=read('src/components/exams-results-v2-hub.tsx');const page=read('src/app/[locale]/exams/page.tsx');
  expect(hub).toContain('getExamActionAvailability');expect(page).toContain('getExamActionAvailability');
  expect(hub).toContain('availability?.calculate');expect(hub).toContain('availability?.approve');expect(hub).toContain('availability?.publish');
 });
 it('keeps standard entry locked and moderation explicitly state-aware',()=>{
  const hub=read('src/components/exams-results-v2-hub.tsx');
  expect(hub).toContain('name="moderatedRawMarks"');expect(hub).toContain('fd.get("moderatedRawMarks")');
  expect(hub).toContain('disabled={!availability?.enterMarks}');expect(hub).toContain('availability?.moderateMarks');
  expect(hub).toContain('moderationWarning');
 });
 it('does not expose report-card actions before publication',()=>{
  const hub=read('src/components/exams-results-v2-hub.tsx');
  expect(hub).toContain('availability?.reports&&data.analysis?.students?.length');expect(hub).toContain('availability?.reports?<Link');
 });
 it('uses mobile card labels for report cards and operational reports',()=>{
  const reportCard=read('src/app/[locale]/exams/report-card/[personId]/page.tsx');const reportsHub=read('src/components/reports-hub.tsx');const reportsCss=read('src/app/[locale]/reports/page.module.css');
  expect(reportCard).toContain('data-label={t.subjects}');expect(reportsHub).toContain('data-label={columnLabel(c,locale)}');expect(reportsCss).toContain('content: attr(data-label)');
 });
 it('keeps narrow-screen tables card-based while print restores the governed table',()=>{
  const examsCss=read('src/app/[locale]/exams/exams.css');const reportsCss=read('src/app/[locale]/reports/page.module.css');
  expect(examsCss).toContain('@media(max-width:520px)');expect(reportsCss).toContain('@media (max-width: 760px)');
  expect(examsCss).toContain('.report-card-table td::before{content:attr(data-label)');expect(examsCss).toContain('@media print');
  expect(examsCss.lastIndexOf('@media print')).toBeGreaterThan(examsCss.lastIndexOf('.report-card-table td::before'));
 });
});

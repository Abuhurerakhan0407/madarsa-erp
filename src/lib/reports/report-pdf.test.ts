import {describe,expect,it} from 'vitest';
import {extractText} from 'pdfnative';
import {operationalReportKeys} from './model';
import {createOperationalReportPdf,supportsOperationalReportPdf} from './report-pdf';
import type {ReportResult} from './workspace';
function result(reportKey:string,columns:string[],rows:Record<string,unknown>[]):ReportResult{return{runId:42,reportKey,labels:{en:reportKey},columns,rows,rowCount:rows.length,parameters:{},outputFormat:'json'};}
describe('Phase 10 operational report PDF',()=>{
 it('renders generic live report rows across landscape pages with Unicode intact',async()=>{const rows=Array.from({length:90},(_,index)=>({attendance_date:'2026-09-03',student_number:`S-${index+1}`,name:index===89?'محمد عبداللہ':`Student ${index+1}`,program:'Hifz',class_group:'A',status:'present',source:'biometric',marked_at:'08:00'}));const pdf=await createOperationalReportPdf(result('daily_attendance',['attendance_date','student_number','name','program','class_group','status','source','marked_at'],rows),{institutionName:'Al-Noor Islamic Academy',branchName:'Central Campus'});const pages=extractText(pdf);const text=pages.map(page=>page.text).join('\n');expect(new TextDecoder().decode(pdf).startsWith('%PDF-')).toBe(true);expect(pages.length).toBeGreaterThan(1);expect(text).toContain('Attendance');expect(text).toContain('S-90');expect(text).toMatch(/[\u0600-\u06ff\ufb50-\ufdff\ufe70-\ufeff]/u);expect(text).not.toContain('????');});
 it('supports exactly all ten Client V2 operational report PDFs',()=>{for(const key of operationalReportKeys)expect(supportsOperationalReportPdf(key)).toBe(true);expect(supportsOperationalReportPdf('student_master')).toBe(false);expect(supportsOperationalReportPdf('admission_register')).toBe(false);});
});

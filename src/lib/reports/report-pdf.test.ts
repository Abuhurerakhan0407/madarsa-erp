import {describe,expect,it} from 'vitest';
import {operationalReportKeys} from './model';
import {createOperationalReportPdf,supportsOperationalReportPdf} from './report-pdf';
import type {ReportResult} from './workspace';
function result(reportKey:string,columns:string[],rows:Record<string,unknown>[]):ReportResult{return{runId:42,reportKey,labels:{en:reportKey},columns,rows,rowCount:rows.length,parameters:{},outputFormat:'json'};}
describe('Phase 10 operational report PDF',()=>{
 it('renders generic live report rows across landscape pages',()=>{const rows=Array.from({length:25},(_,index)=>({attendance_date:'2026-09-03',student_number:`S-${index+1}`,name:`Student ${index+1}`,program:'Hifz',class_group:'A',status:'present',source:'biometric',marked_at:'08:00'}));const pdf=createOperationalReportPdf(result('daily_attendance',['attendance_date','student_number','name','program','class_group','status','source','marked_at'],rows),{institutionName:'Al-Noor Islamic Academy',branchName:'Central Campus'});const text=new TextDecoder().decode(pdf);expect(text.startsWith('%PDF-1.4')).toBe(true);expect(text).toContain('/MediaBox [0 0 842 595]');expect(text).toContain('/Count 2');expect(text).toContain('Attendance');expect(text).toContain('Student 25');});
 it('supports exactly all ten Client V2 operational report PDFs',()=>{for(const key of operationalReportKeys)expect(supportsOperationalReportPdf(key)).toBe(true);expect(supportsOperationalReportPdf('student_master')).toBe(false);expect(supportsOperationalReportPdf('admission_register')).toBe(false);});
});

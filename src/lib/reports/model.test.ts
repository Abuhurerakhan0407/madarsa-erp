import {describe,expect,it} from 'vitest';
import {reportSupportsParameter,supportedOperationalReports,validateReportRun} from './model';

describe('report validators',()=>{
 it('accepts every implemented operational report with only valid parameters',()=>{
  for(const reportKey of supportedOperationalReports){
   const parameters=reportKey==='new_admissions'?{date_from:'2026-08-01',date_to:'2026-08-31'}:{};
   const r=validateReportRun({reportKey,parameters,outputFormat:'screen',requestKey:`report-request-${reportKey}-0001`});
   expect(r.errors,reportKey).toEqual([]);
   expect(r.value?.reportKey).toBe(reportKey);
  }
 });
 it('accepts attendance date compatibility',()=>{const r=validateReportRun({reportKey:'daily_attendance',parameters:{attendance_date:'2026-08-31'},outputFormat:'csv',requestKey:'report-request-00000002'});expect(r.errors).toEqual([]);expect(r.value?.parameters.attendance_date).toBe('2026-08-31');});
 it('accepts published register reports',()=>{
  for(const reportKey of ['student_master','admission_register','employee_register']){
   const r=validateReportRun({reportKey,parameters:{},outputFormat:'screen',requestKey:`report-request-${reportKey}-0003`});
   expect(r.errors,reportKey).toEqual([]);
   expect(r.value?.reportKey).toBe(reportKey);
  }
 });
 it('rejects unsupported report',()=>{expect(validateReportRun({reportKey:'fees_collection',parameters:{},outputFormat:'screen',requestKey:'report-request-00000003'}).value).toBeUndefined();});
 it('rejects invalid report date',()=>{expect(validateReportRun({reportKey:'daily_attendance',parameters:{date_from:'31/08/2026'},outputFormat:'screen',requestKey:'report-request-00000004'}).value).toBeUndefined();});
 it('rejects invalid identifier filters',()=>{expect(validateReportRun({reportKey:'student_strength',parameters:{program_id:0},outputFormat:'screen',requestKey:'report-request-00000005'}).value).toBeUndefined();});
 it('rejects unsupported output format',()=>{expect(validateReportRun({reportKey:'student_strength',parameters:{},outputFormat:'xlsx',requestKey:'report-request-00000006'}).value).toBeUndefined();});
 it('requires an idempotency key',()=>{expect(validateReportRun({reportKey:'student_strength',parameters:{},outputFormat:'screen',requestKey:'short'}).value).toBeUndefined();});
 it('requires a valid date range for New Admissions',()=>{
  expect(validateReportRun({reportKey:'new_admissions',parameters:{},outputFormat:'screen',requestKey:'report-request-new-admissions-01'}).value).toBeUndefined();
  expect(validateReportRun({reportKey:'new_admissions',parameters:{date_from:'2026-09-20',date_to:'2026-09-01'},outputFormat:'screen',requestKey:'report-request-new-admissions-02'}).value).toBeUndefined();
 });
 it('rejects individual-student filters for aggregate reports',()=>{
  for(const reportKey of ['student_strength','absence_trend','late_trend','new_admissions'] as const){
   const parameters=reportKey==='new_admissions'?{date_from:'2026-09-01',date_to:'2026-09-25',student_person_id:7}:{student_person_id:7};
   expect(validateReportRun({reportKey,parameters,outputFormat:'screen',requestKey:`report-request-${reportKey}-student`}).value,reportKey).toBeUndefined();
   expect(reportSupportsParameter(reportKey,'student_person_id'),reportKey).toBe(false);
  }
 });
 it('keeps individual student filtering for detail reports',()=>{
  expect(reportSupportsParameter('daily_attendance','student_person_id')).toBe(true);
  expect(reportSupportsParameter('quran_progress','student_person_id')).toBe(true);
  expect(reportSupportsParameter('program_progress','student_person_id')).toBe(true);
  expect(reportSupportsParameter('exam_performance','student_person_id')).toBe(true);
 });
});

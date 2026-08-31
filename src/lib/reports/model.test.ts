import {describe,expect,it} from 'vitest';
import {validateReportRun} from './model';
describe('report validators',()=>{
 it('accepts student master report',()=>{const r=validateReportRun({reportKey:'student_master',parameters:{},outputFormat:'screen',requestKey:'report-request-00000001'});expect(r.errors).toEqual([]);expect(r.value?.reportKey).toBe('student_master');});
 it('accepts attendance date',()=>{const r=validateReportRun({reportKey:'daily_attendance',parameters:{attendance_date:'2026-08-31'},outputFormat:'csv',requestKey:'report-request-00000002'});expect(r.errors).toEqual([]);expect(r.value?.parameters.attendance_date).toBe('2026-08-31');});
 it('rejects unsupported report',()=>{expect(validateReportRun({reportKey:'fees_collection',parameters:{},outputFormat:'screen',requestKey:'report-request-00000003'}).value).toBeUndefined();});
 it('rejects invalid attendance date',()=>{expect(validateReportRun({reportKey:'daily_attendance',parameters:{attendance_date:'31/08/2026'},outputFormat:'screen',requestKey:'report-request-00000004'}).value).toBeUndefined();});
 it('rejects unsupported output format',()=>{expect(validateReportRun({reportKey:'student_master',parameters:{},outputFormat:'xlsx',requestKey:'report-request-00000005'}).value).toBeUndefined();});
 it('requires an idempotency key',()=>{expect(validateReportRun({reportKey:'student_master',parameters:{},outputFormat:'screen',requestKey:'short'}).value).toBeUndefined();});
});
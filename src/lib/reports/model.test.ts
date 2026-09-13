import {describe,expect,it} from 'vitest';
import {operationalReportKeys,validateReportRun} from './model';
describe('Phase 10 report validators',()=>{
 it('accepts all ten operational presets',()=>{for(const reportKey of operationalReportKeys){const r=validateReportRun({reportKey,parameters:{date_from:'2026-08-01',date_to:'2026-09-03'},outputFormat:'screen',requestKey:`report-request-${reportKey}-0001`});expect(r.errors).toEqual([]);expect(r.value?.reportKey).toBe(reportKey);}});
 it('accepts positive program/group/person filters',()=>{const r=validateReportRun({reportKey:'daily_attendance',parameters:{date_from:'2026-08-01',date_to:'2026-09-03',program_id:1,group_id:2,student_person_id:3},outputFormat:'csv',requestKey:'report-request-filter-000001'});expect(r.errors).toEqual([]);});
 it('rejects unsupported legacy or fake report keys',()=>{expect(validateReportRun({reportKey:'student_master',parameters:{},outputFormat:'screen',requestKey:'report-request-legacy-00001'}).value).toBeUndefined();expect(validateReportRun({reportKey:'fees_collection',parameters:{},outputFormat:'screen',requestKey:'report-request-fake-0000001'}).value).toBeUndefined();});
 it('rejects invalid date range and ids',()=>{expect(validateReportRun({reportKey:'daily_attendance',parameters:{date_from:'2026-09-03',date_to:'2026-08-01',group_id:-1},outputFormat:'screen',requestKey:'report-request-invalid-00001'}).value).toBeUndefined();});
 it('rejects unsupported output format and short request key',()=>{expect(validateReportRun({reportKey:'student_strength',parameters:{},outputFormat:'xlsx',requestKey:'short'}).value).toBeUndefined();});
});

import {describe,expect,it} from 'vitest';
import {formatReportCell} from './presentation';

describe('report screen presentation',()=>{
 it('humanizes governed enum values without changing their source data',()=>{
  expect(formatReportCell('status','active','en')).toBe('Active');
  expect(formatReportCell('attendance_today','absent','ur')).toBe('غیر حاضر');
  expect(formatReportCell('state','results_published','ur')).toBe('نتائج جاری');
 });

 it('formats dates, times and percentages for human reading',()=>{
  expect(formatReportCell('attendance_date','2026-09-15','en')).toContain('2026');
  expect(formatReportCell('check_in','08:05:44','en')).toBe('08:05');
  expect(formatReportCell('attendance_rate',92.5,'en')).toBe('92.5%');
 });

 it('uses a clear dash for missing values and readable summaries for objects',()=>{
  expect(formatReportCell('status',null,'en')).toBe('—');
  expect(formatReportCell('note',{reason:'manual correction'},'en')).toContain('Reason: manual correction');
 });
});

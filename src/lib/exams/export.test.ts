import {describe,expect,it} from 'vitest';
import {examCsvCell,examExportFilename} from './export';

describe('exam result CSV export',()=>{
 it('preserves ordinary raw values while quoting CSV safely',()=>{
  expect(examCsvCell('ST-001')).toBe('"ST-001"');
  expect(examCsvCell('Khan, Ayaan')).toBe('"Khan, Ayaan"');
  expect(examCsvCell('A"B')).toBe('"A""B"');
  expect(examCsvCell(88.5)).toBe('"88.5"');
 });
 it('neutralizes spreadsheet formula prefixes in user-controlled text',()=>{
  for(const value of ['=2+2','+SUM(A1:A2)','-1+2','@cmd'])expect(examCsvCell(value)).toBe(`"'${value}"`);
 });
 it('creates a bounded safe export filename',()=>{
  expect(examExportFilename('Term / 1 Results')).toBe('Term-1-Results');
  expect(examExportFilename('***')).toBe('exam-results');
 });
});

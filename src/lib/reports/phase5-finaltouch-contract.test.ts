import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const read=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8');

describe('Phase 5 reports final-touch contract',()=>{
 it('uses Preview language instead of Run on screen',()=>{
  const copy=read('src/lib/reports/copy.ts');
  const page=read('src/app/[locale]/reports/page.tsx');
  expect(copy).toContain("generate:'Preview'");
  expect(copy).toContain("screen:'Preview'");
  expect(copy).not.toContain("generate:'Run on screen'");
  expect(page).toContain('then preview it');
 });

 it('formats screen cells without changing CSV raw export handling',()=>{
  const hub=read('src/components/reports-hub.tsx');
  const presentation=read('src/lib/reports/presentation.ts');
  expect(hub).toContain('formatReportCell(c,row[c],locale)');
  expect(hub).toContain('safeCsvCell(row[c])');
  expect(presentation).toContain('percentageColumns');
  expect(presentation).toContain('dateTimeColumns');
  expect(presentation).toContain('urduEnum');
 });

 it('keeps the report table readable on narrow screens',()=>{
  const css=read('src/app/[locale]/reports/page.module.css');
  expect(css).toContain('position: sticky');
  expect(css).toContain('overflow-wrap: anywhere');
  expect(css).toContain('min-width: 48rem');
 });
});

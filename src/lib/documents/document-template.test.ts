import {describe,expect,it} from 'vitest';
import {createStructuredDocumentPdf} from './document-template';

describe('shared structured document template',()=>{
 it('creates one governed A4 page per document with reusable fields and details',()=>{
  const pdf=createStructuredDocumentPdf({title:'Student Profiles',institutionName:'Ilmgaah Academy',branchName:'Main Branch',documents:[
   {heading:'Ayaan Khan',subheading:'Student Profile',fields:[{label:'Student ID',value:'ST-001'},{label:'Program',value:'Hifz'}],footer:'Canonical profile'},
   {heading:'Sara Khan',subheading:'Student Profile',fields:[{label:'Student ID',value:'ST-002'}],details:['Guardian: Ahmed']}
  ]});
  const text=new TextDecoder().decode(pdf);
  expect(text.startsWith('%PDF-1.4')).toBe(true);
  expect(text).toContain('%ILMGAAH');
  expect(text).toContain('/Count 2');
  expect(text).toContain('Student Profiles');
  expect(text).toContain('Ayaan Khan');
  expect(text).toContain('Guardian: Ahmed');
  expect(text).toContain('531 778 re S');
 });
});

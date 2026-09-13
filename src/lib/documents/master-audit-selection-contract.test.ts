import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const migration=readFileSync('supabase/migrations/20260912192000_master_audit_document_selection_hardening.sql','utf8');
const workspace=readFileSync('src/lib/documents/workspace.ts','utf8');
const route=readFileSync('src/app/api/documents/pdf/route.ts','utf8');
const component=readFileSync('src/components/document-center-v2.tsx','utf8');

describe('master audit document selection and certificate retry hardening',()=>{
 it('resolves explicit selections through a scoped batch RPC instead of the population paginator',()=>{
  expect(migration).toContain('get_operational_document_students_by_ids_v1');
  expect(migration).toContain('cardinality(p_student_person_ids) > 250');
  expect(migration).toContain("rp.permission_code='documents.file.read'");
  expect(migration).toContain('e.student_person_id=r.person_id');
  expect(migration).toContain('to service_role');
  expect(workspace).toContain("admin.rpc('get_operational_document_students_by_ids_v1'");
  expect(workspace).toContain('if(!unique)return getAllDocumentStudents(args);');
  expect(workspace).toContain('const selected=await getSelectedDocumentStudents(args,unique);');
  expect(workspace).not.toContain('const rows=await getAllDocumentStudents(args);if(!unique)return rows;');
 });

 it('uses a stable operation key for certificate retries',()=>{
  expect(route).toContain("const operationKey=requestKey(raw.requestKey)");
  expect(route).toContain('`${operationKey}:status:${personId}`');
  expect(route).not.toContain('issueStudentStatusCertificate(personId,crypto.randomUUID())');
  expect(component).toContain('const requestKey=crypto.randomUUID()');
  expect(component).toContain('const body=JSON.stringify');
  expect(component).toContain('await postPdf(body)');
  expect(component).toContain('for(let attempt=0;attempt<2;attempt+=1)');
 });
});

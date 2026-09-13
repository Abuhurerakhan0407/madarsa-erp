import {createAdminClient} from '@/lib/supabase/admin';
import {getTenantContext} from '@/lib/tenancy/context';
import type {DocumentStudent as ContractDocumentStudent} from './contract';

export {clientDocumentTypes,documentAvailable,isClientDocumentType} from './contract';
export type {ClientDocumentType,DocumentStudent} from './contract';

type Raw=Record<string,unknown>;
const obj=(v:unknown):Raw=>v&&typeof v==='object'&&!Array.isArray(v)?v as Raw:{};
const arr=(v:unknown):Raw[]=>Array.isArray(v)?v.filter(x=>x&&typeof x==='object'&&!Array.isArray(x)) as Raw[]:[];
const s=(v:unknown)=>typeof v==='string'?v:null;
const n=(v:unknown)=>{const x=Number(v);return Number.isFinite(x)?x:null;};
const b=(v:unknown)=>v===true;

export type DocumentFilterOption={id:number;key:string;labels:Raw;sessionId:number|null;programId:number|null};
export type DocumentCenterArgs={search?:string|null;page?:number;pageSize?:number;sessionId?:number|null;programId?:number|null;groupId?:number|null;studentPersonId?:number|null};

function option(r:Raw):DocumentFilterOption|null{
 const id=n(r.id),key=s(r.key);if(!id||!key)return null;
 return{id,key,labels:obj(r.labels),sessionId:n(r.session_id),programId:n(r.program_id)};
}
function documentRows(value:unknown):ContractDocumentStudent[]{
 return arr(value).flatMap(r=>{
  const personId=n(r.person_id),studentNumber=s(r.student_number),name=s(r.name);if(!personId||!studentNumber||!name)return[];
  return[{personId,studentNumber,admissionNumber:s(r.admission_number),name,nameNative:s(r.name_native),sessionId:n(r.session_id),programId:n(r.program_id),groupId:n(r.group_id),academicYear:s(r.academic_year),program:s(r.program),classGroup:s(r.class_group),photoAvailable:b(r.photo_available),idCardAvailable:b(r.id_card_available),profileAvailable:b(r.profile_available),quranProgressAvailable:b(r.quran_progress_available),reportCardIssued:b(r.report_card_issued),reportCardIssuedAt:s(r.report_card_issued_at)}];
 }) as ContractDocumentStudent[];
}

export async function getDocumentCenter(args:DocumentCenterArgs={}){
 const w=await getTenantContext();if(!w||!w.branchId)throw new Error('Active branch is required.');
 const admin=createAdminClient();
 const page=Math.max(args.page??1,1),pageSize=Math.min(Math.max(args.pageSize??40,1),250);
 const {data,error}=await admin.rpc('get_operational_document_center_v2',{
  p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,
  p_session_id:args.sessionId??null,p_program_id:args.programId??null,p_group_id:args.groupId??null,
  p_student_person_id:args.studentPersonId??null,p_search:args.search??null,p_page:page,p_page_size:pageSize
 });
 if(error)throw new Error(error.message);
 const raw=obj(data),filters=obj(raw.filters);
 return{
  total:n(raw.total)??0,page:n(raw.page)??1,pageSize:n(raw.page_size)??pageSize,selectionLimit:n(raw.selection_limit)??250,
  rows:documentRows(raw.rows),
  filters:{
   sessions:arr(filters.sessions).map(option).filter((x):x is DocumentFilterOption=>Boolean(x)),
   programs:arr(filters.programs).map(option).filter((x):x is DocumentFilterOption=>Boolean(x)),
   groups:arr(filters.groups).map(option).filter((x):x is DocumentFilterOption=>Boolean(x)),
   students:arr(filters.students).flatMap(r=>{const personId=n(r.person_id);if(!personId)return[];return[{personId,studentNumber:s(r.student_number)??'',admissionNumber:s(r.admission_number),name:s(r.name)??`Student ${personId}`}];})
  },
  recentIssued:arr(raw.recent_issued).map(r=>({issueId:n(r.issue_id)??0,documentType:s(r.document_type)??'',personId:n(r.person_id)??0,studentName:s(r.student_name)??'',templateKey:s(r.template_key)??'',revision:n(r.revision)??1,issuedAt:s(r.issued_at)??''}))
 };
}

export async function getAllDocumentStudents(args:Omit<DocumentCenterArgs,'page'|'pageSize'>={},maximum=5000):Promise<ContractDocumentStudent[]>{
 const first=await getDocumentCenter({...args,page:1,pageSize:250});
 if(first.total>maximum)throw new Error(`Filtered document batch exceeds ${maximum} students. Narrow the filters before generating documents.`);
 const rows=[...first.rows];const pages=Math.ceil(first.total/first.pageSize);
 for(let page=2;page<=pages;page+=1){const next=await getDocumentCenter({...args,page,pageSize:first.pageSize});rows.push(...next.rows);}
 return rows;
}

async function getSelectedDocumentStudents(args:Omit<DocumentCenterArgs,'page'|'pageSize'>,personIds:number[]):Promise<ContractDocumentStudent[]>{
 const w=await getTenantContext();if(!w||!w.branchId)throw new Error('Active branch is required.');
 const admin=createAdminClient();
 const {data,error}=await admin.rpc('get_operational_document_students_by_ids_v1',{
  p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_student_person_ids:personIds,
  p_session_id:args.sessionId??null,p_program_id:args.programId??null,p_group_id:args.groupId??null,p_search:args.search??null
 });
 if(error)throw new Error(error.message);
 return documentRows(obj(data).rows);
}

export async function resolveDocumentStudents(args:Omit<DocumentCenterArgs,'page'|'pageSize'>,personIds?:number[]|null):Promise<ContractDocumentStudent[]>{
 const unique=personIds?.length?[...new Set(personIds.filter(id=>Number.isInteger(id)&&id>0))]:null;
 if(unique&&unique.length>250)throw new Error('Select no more than 250 students at one time.');
 if(!unique)return getAllDocumentStudents(args);
 const selected=await getSelectedDocumentStudents(args,unique);
 if(selected.length!==unique.length)throw new Error('One or more selected students are outside the active filters or branch.');
 return selected;
}

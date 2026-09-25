import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";
import type { StudentImportRow } from "@/lib/students/csv-import";

type Raw=Record<string,unknown>;
const object=(value:unknown):Raw=>value&&typeof value==="object"&&!Array.isArray(value)?value as Raw:{};
const rows=(value:unknown):Raw[]=>Array.isArray(value)?value.filter((item)=>item&&typeof item==="object"&&!Array.isArray(item)) as Raw[]:[];
const text=(value:unknown):string|null=>typeof value==="string"&&value.trim()?value:null;
const number=(value:unknown):number|null=>Number.isFinite(Number(value))?Number(value):null;
const label=(value:unknown):string=>{const row=object(value);return text(row.en)??text(row.ur)??text(row.ar)??"Unnamed";};

export type LifecycleSession={id:number;key:string;label:string;startsOn:string;endsOn:string;status:string;isDefault:boolean};
export type LifecycleGroup={id:number;sessionId:number;programId:number;levelId:number|null;key:string;label:string;programLabel:string;capacity:number|null;status:string};
export type LifecycleStudent={personId:number;studentNumber:string;name:string;enrollmentId:number;sessionId:number;programId:number;groupId:number|null;startsOn:string;status:string};
export type LifecycleJob={id:number;operationType:"import"|"promotion"|"renewal";state:string;totalItems:number;succeededItems:number;blockedItems:number;failedItems:number;summary:Raw;createdAt:string;completedAt:string|null};
export type StudentLifecycleCenter={sessions:LifecycleSession[];groups:LifecycleGroup[];students:LifecycleStudent[];jobs:LifecycleJob[]};

async function workspace(){const value=await getTenantContext();if(!value||!value.branchId)throw new Error("Active branch is required.");return value;}

export async function getStudentLifecycleCenter():Promise<StudentLifecycleCenter>{
 const w=await workspace();const admin=createAdminClient();const{data,error}=await admin.rpc("get_student_lifecycle_center_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId});
 if(error)throw new Error(`Unable to load student lifecycle center: ${error.message}`);const raw=object(data);
 return{
  sessions:rows(raw.sessions).flatMap((r)=>{const id=number(r.id),key=text(r.key),startsOn=text(r.starts_on),endsOn=text(r.ends_on);return id&&key&&startsOn&&endsOn?[{id,key,label:label(r.labels),startsOn,endsOn,status:text(r.status)??"draft",isDefault:Boolean(r.is_default)}]:[];}),
  groups:rows(raw.groups).flatMap((r)=>{const id=number(r.id),sessionId=number(r.session_id),programId=number(r.program_id),key=text(r.key);return id&&sessionId&&programId&&key?[{id,sessionId,programId,levelId:number(r.level_id),key,label:label(r.labels),programLabel:label(r.program_labels),capacity:number(r.capacity),status:text(r.status)??"active"}]:[];}),
  students:rows(raw.students).flatMap((r)=>{const personId=number(r.student_person_id),studentNumber=text(r.student_number),name=text(r.display_name),enrollmentId=number(r.enrollment_id),sessionId=number(r.session_id),programId=number(r.program_id),startsOn=text(r.starts_on);return personId&&studentNumber&&name&&enrollmentId&&sessionId&&programId&&startsOn?[{personId,studentNumber,name,enrollmentId,sessionId,programId,groupId:number(r.group_id),startsOn,status:text(r.status)??"active"}]:[];}),
  jobs:rows(raw.jobs).flatMap((r)=>{const id=number(r.id),operationType=text(r.operation_type),createdAt=text(r.created_at);return id&&createdAt&&(operationType==="import"||operationType==="promotion"||operationType==="renewal")?[{id,operationType,state:text(r.state)??"processing",totalItems:number(r.total_items)??0,succeededItems:number(r.succeeded_items)??0,blockedItems:number(r.blocked_items)??0,failedItems:number(r.failed_items)??0,summary:object(r.summary),createdAt,completedAt:text(r.completed_at)}]:[];})
 };
}

export async function prepareNextAcademicSession(input:{sourceSessionId:number;key:string;labels:{en:string;ur?:string};startsOn:string;endsOn:string}){
 const w=await workspace();const admin=createAdminClient();const{data,error}=await admin.rpc("prepare_next_academic_session_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_source_session_id:input.sourceSessionId,p_key:input.key,p_labels:input.labels,p_starts_on:input.startsOn,p_ends_on:input.endsOn});if(error)throw new Error(error.message);return object(data);
}

export async function importStudentsBatch(input:{sessionId:number;programId:number;groupId:number;joinedOn:string;rows:StudentImportRow[];requestKey:string}){
 const w=await workspace();const admin=createAdminClient();const{data,error}=await admin.rpc("import_students_batch_v2",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_session_id:input.sessionId,p_program_id:input.programId,p_group_id:input.groupId,p_joined_on:input.joinedOn,p_rows:input.rows,p_request_key:input.requestKey});if(error)throw new Error(error.message);return object(data);
}

export async function planStudentRollover(input:{studentPersonIds:number[];targetSessionId:number;targetGroupId:number;mode:"promotion"|"renewal";requestKey:string}){
 const w=await workspace();const admin=createAdminClient();const{data,error}=await admin.rpc("plan_student_rollover_batch_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_student_person_ids:input.studentPersonIds,p_target_session_id:input.targetSessionId,p_target_group_id:input.targetGroupId,p_mode:input.mode,p_request_key:input.requestKey});if(error)throw new Error(error.message);return object(data);
}

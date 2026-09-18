import {createAdminClient} from '@/lib/supabase/admin';
import {getTenantContext} from '@/lib/tenancy/context';
type Raw=Record<string,unknown>;
const obj=(v:unknown):Raw=>v&&typeof v==='object'&&!Array.isArray(v)?v as Raw:{};
const arr=(v:unknown):Raw[]=>Array.isArray(v)?v.filter(x=>x&&typeof x==='object'&&!Array.isArray(x)) as Raw[]:[];
const s=(v:unknown)=>typeof v==='string'?v:null;
const n=(v:unknown)=>{const x=Number(v);return Number.isFinite(x)?x:null;};
async function rpc(name:string,args:Raw={}){const w=await getTenantContext();if(!w||!w.branchId)throw new Error('Active branch is required.');const admin=createAdminClient();const {data,error}=await admin.rpc(name,{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,...args});if(error)throw new Error(error.message);return data;}
export type ReportDefinition={id:number;key:string;labels:Raw;domain:string;parameterSchema:Raw;allowedColumns:string[]};
export type ReportFilterOption={id:number;key:string;labels:Raw;sessionId:number|null;programId:number|null};
export type ReportPersonFilter={personId:number;reference:string;name:string;designation:string|null};
function option(r:Raw):ReportFilterOption|null{const id=n(r.id),key=s(r.key);if(!id||!key)return null;return{id,key,labels:obj(r.labels),sessionId:n(r.session_id),programId:n(r.program_id)};}
export async function getReportsHub(){const raw=obj(await rpc('get_operational_reports_hub_v1'));const filters=obj(raw.filters);return{
 localDate:s(raw.local_date)??'',
 reports:arr(raw.reports).flatMap(r=>{const id=n(r.id),key=s(r.key);if(!id||!key)return[];return[{id,key,labels:obj(r.labels),domain:s(r.domain)??'operations',parameterSchema:obj(r.parameter_schema),allowedColumns:Array.isArray(r.allowed_columns)?r.allowed_columns.filter((x):x is string=>typeof x==='string'):[]}];}) as ReportDefinition[],
 recentRuns:arr(raw.recent_runs).map(r=>({id:n(r.id)??0,reportKey:s(r.report_key)??'',labels:obj(r.labels),parameters:obj(r.parameters),outputFormat:s(r.output_format)??'screen',state:s(r.state)??'completed',rowCount:n(r.row_count)??0,createdAt:s(r.created_at)??'',completedAt:s(r.completed_at)})),
 filters:{
  sessions:arr(filters.sessions).map(option).filter((x):x is ReportFilterOption=>Boolean(x)),
  programs:arr(filters.programs).map(option).filter((x):x is ReportFilterOption=>Boolean(x)),
  groups:arr(filters.groups).map(option).filter((x):x is ReportFilterOption=>Boolean(x)),
  students:arr(filters.students).flatMap(r=>{const personId=n(r.person_id);if(!personId)return[];return[{personId,reference:s(r.student_number)??'',name:s(r.name)??`Student ${personId}`,designation:null}];}) as ReportPersonFilter[],
  teachers:arr(filters.teachers).flatMap(r=>{const personId=n(r.person_id);if(!personId)return[];return[{personId,reference:s(r.teacher_id)??'',name:s(r.name)??`Teacher ${personId}`,designation:s(r.designation)}];}) as ReportPersonFilter[]
 }
};}
export type ReportResult={runId:number;reportKey:string;labels:Raw;columns:string[];rows:Raw[];rowCount:number;parameters:Raw;outputFormat:string};
export function parseReportResult(input:unknown):ReportResult{const raw=obj(input);return{runId:n(raw.run_id)??0,reportKey:s(raw.report_key)??'',labels:obj(raw.labels),columns:Array.isArray(raw.columns)?raw.columns.filter((x):x is string=>typeof x==='string'):[],rows:arr(raw.rows),rowCount:n(raw.row_count)??0,parameters:obj(raw.parameters),outputFormat:s(raw.output_format)??'screen'};}

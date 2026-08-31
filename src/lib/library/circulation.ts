import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";

type Raw=Record<string,unknown>;
const obj=(v:unknown):Raw=>v&&typeof v==="object"&&!Array.isArray(v)?v as Raw:{};
const rows=(v:unknown):Raw[]=>Array.isArray(v)?v.filter((x)=>x&&typeof x==="object"&&!Array.isArray(x)) as Raw[]:[];
const text=(v:unknown):string|null=>typeof v==="string"&&v.trim()?v:null;
const num=(v:unknown):number|null=>Number.isFinite(Number(v))?Number(v):null;

export type LibraryCenter={
 titles:Array<{id:number;title:string;authors:string[];category:string|null;copyCount:number;availableCount:number;state:string}>;
 copies:Array<{id:number;titleId:number;title:string;accessionNumber:string;condition:string;state:string}>;
 loans:Array<{id:number;copyId:number;borrowerPersonId:number;borrowerName:string;title:string;accessionNumber:string;issuedAt:string;dueAt:string;returnedAt:string|null;state:string}>;
 borrowers:Array<{personId:number;displayName:string;borrowerType:string;reference:string|null}>;
};
async function ws(){const w=await getTenantContext();if(!w||!w.branchId)throw new Error("Active branch is required.");return w;}
export async function getLibraryCenter():Promise<LibraryCenter>{const w=await ws();const admin=createAdminClient();const{data,error}=await admin.rpc("get_library_center_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId});if(error)throw new Error(`Unable to load library: ${error.message}`);const raw=obj(data);return{
 titles:rows(raw.titles).flatMap(r=>{const id=num(r.id),title=text(r.title_en);return id&&title?[{id,title,authors:Array.isArray(r.authors)?r.authors.filter((x):x is string=>typeof x==="string"):[],category:text(r.category),copyCount:num(r.copy_count)??0,availableCount:num(r.available_count)??0,state:text(r.state)??"active"}]:[]}),
 copies:rows(raw.copies).flatMap(r=>{const id=num(r.id),titleId=num(r.title_id),title=text(r.title_en),a=text(r.accession_number);return id&&titleId&&title&&a?[{id,titleId,title,accessionNumber:a,condition:text(r.condition)??"good",state:text(r.state)??"available"}]:[]}),
 loans:rows(raw.loans).flatMap(r=>{const id=num(r.id),copyId=num(r.copy_id),bp=num(r.borrower_person_id),bn=text(r.borrower_name),title=text(r.title_en),a=text(r.accession_number),issued=text(r.issued_at),due=text(r.due_at);return id&&copyId&&bp&&bn&&title&&a&&issued&&due?[{id,copyId,borrowerPersonId:bp,borrowerName:bn,title,accessionNumber:a,issuedAt:issued,dueAt:due,returnedAt:text(r.returned_at),state:text(r.state)??"issued"}]:[]}),
 borrowers:rows(raw.borrowers).flatMap(r=>{const personId=num(r.person_id),displayName=text(r.display_name);return personId&&displayName?[{personId,displayName,borrowerType:text(r.borrower_type)??"person",reference:text(r.student_number)??text(r.employee_number)}]:[]})
};}
export async function createLibraryTitle(input:{title:string;authors:string[];category:string|null}){const w=await ws();const admin=createAdminClient();const{data,error}=await admin.rpc("create_library_title_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_labels:{en:input.title},p_authors:input.authors,p_publisher:null,p_category:input.category,p_edition:null,p_isbn:null,p_classification:null});if(error)throw new Error(error.message);return obj(data);}
export async function addLibraryCopy(input:{titleId:number;accessionNumber:string;condition:string}){const w=await ws();const admin=createAdminClient();const{data,error}=await admin.rpc("add_library_copy_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_title_id:input.titleId,p_accession_number:input.accessionNumber,p_condition:input.condition});if(error)throw new Error(error.message);return obj(data);}
export async function issueLibraryLoan(input:{copyId:number;borrowerPersonId:number;dueAt:string}){const w=await ws();const admin=createAdminClient();const{data,error}=await admin.rpc("issue_library_loan_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_copy_id:input.copyId,p_borrower_person_id:input.borrowerPersonId,p_due_at:input.dueAt});if(error)throw new Error(error.message);return obj(data);}
export async function returnLibraryLoan(input:{loanId:number;condition:string}){const w=await ws();const admin=createAdminClient();const{data,error}=await admin.rpc("return_library_loan_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_loan_id:input.loanId,p_copy_condition:input.condition});if(error)throw new Error(error.message);return obj(data);}

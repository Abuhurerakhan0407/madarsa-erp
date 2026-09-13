import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNavigationAudience } from "@/lib/navigation/audience";
import { getTenantContext } from "@/lib/tenancy/context";

export type MyStudentRow={personId:number;studentNumber:string;name:string;nativeName:string|null;groupId:number;group:string};
export type MyStudentsResult={rows:MyStudentRow[];total:number;page:number;pageSize:number;asOfDate:string|null};
type Raw=Record<string,unknown>;
const object=(value:unknown):Raw=>value&&typeof value==="object"&&!Array.isArray(value)?value as Raw:{};
const rows=(value:unknown):Raw[]=>Array.isArray(value)?value.filter(item=>item&&typeof item==="object"&&!Array.isArray(item)) as Raw[]:[];
const number=(value:unknown)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:null;};
const string=(value:unknown)=>typeof value==="string"?value:null;
function label(value:unknown,locale:string,fallback:string){if(!value||typeof value!=="object"||Array.isArray(value))return fallback;const r=value as Record<string,unknown>;const v=r[locale]??r.en;return typeof v==="string"&&v.trim()?v:fallback;}

export async function getMyStudents(locale:string,args:{search?:string|null;page?:number;pageSize?:number}={}):Promise<MyStudentsResult>{
 const w=await getTenantContext();if(!w||!w.branchId)notFound();if(await getNavigationAudience(w)!=="teacher")notFound();
 const page=Math.max(args.page??1,1),pageSize=Math.min(Math.max(args.pageSize??40,1),100);const search=args.search?.trim().slice(0,120)||null;
 const admin=createAdminClient();const {data,error}=await admin.rpc("get_teacher_student_roster_v1",{
  p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_as_of_date:null,p_search:search,p_page:page,p_page_size:pageSize
 });
 if(error)throw new Error(`Unable to load assigned students: ${error.message}`);const raw=object(data);
 return{
  total:number(raw.total)??0,page:number(raw.page)??page,pageSize:number(raw.page_size)??pageSize,asOfDate:string(raw.as_of_date),
  rows:rows(raw.rows).flatMap(row=>{const personId=number(row.person_id),groupId=number(row.group_id),studentNumber=string(row.student_number),name=string(row.name);if(!personId||!groupId||!studentNumber||!name)return[];return[{personId,studentNumber,name,nativeName:string(row.name_native),groupId,group:label(row.group_labels,locale,string(row.group_key)??"—")}];})
 };
}

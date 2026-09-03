import {createAdminClient} from "@/lib/supabase/admin";
import {getTenantContext} from "@/lib/tenancy/context";

type Raw=Record<string,unknown>;
export type TeacherLabels={en?:string;ur?:string;ar?:string};
export type TeacherAssignment={id:number;labels:TeacherLabels};
export type TeacherScheduleItem={weekday:number;startsAt:string;endsAt:string;groupId:number;groupLabels:TeacherLabels;subjectId:number;subjectLabels:TeacherLabels;room:string|null};
export type TeacherRow={
 employmentId:number;personId:number;teacherId:string;displayName:string;nameNative:string|null;photoStoragePath:string|null;
 designation:string;designationKey:string;joinedOn:string;state:string;email:string|null;phone:string|null;
 accountStatus:"active"|"disabled"|"not_created"|"email_required";lastLogin:string|null;erpManaged:boolean;
 attendance:{total:number;present:number;absent:number;late:number};
 assignedPrograms:TeacherAssignment[];assignedSubjects:TeacherAssignment[];assignedGroups:TeacherAssignment[];timetable:TeacherScheduleItem[];
};
export type TeachersWorkspace={canManage:boolean;teachers:TeacherRow[]};

const obj=(v:unknown):Raw=>v&&typeof v==="object"&&!Array.isArray(v)?v as Raw:{};
const arr=(v:unknown):Raw[]=>Array.isArray(v)?v.filter((x)=>x&&typeof x==="object"&&!Array.isArray(x)) as Raw[]:[];
const str=(v:unknown):string|null=>typeof v==="string"&&v.trim()?v:null;
const num=(v:unknown):number|null=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const labels=(v:unknown):TeacherLabels=>{const r=obj(v);return{en:str(r.en)??undefined,ur:str(r.ur)??undefined,ar:str(r.ar)??undefined};};
const assignments=(v:unknown):TeacherAssignment[]=>arr(v).flatMap((r)=>{const id=num(r.id);return id?[{id,labels:labels(r.labels)}]:[];});

export async function getTeachersWorkspace(args?:{search?:string;state?:string}):Promise<TeachersWorkspace>{
 const w=await getTenantContext();if(!w||!w.branchId)throw new Error("Active branch is required.");
 const admin=createAdminClient();const{data,error}=await admin.rpc("get_teachers_workspace_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_search:args?.search?.trim()||null,p_state:args?.state||null});
 if(error)throw new Error(`Unable to load teachers: ${error.message}`);const raw=obj(data);
 const teachers=arr(raw.teachers).flatMap((r)=>{const employmentId=num(r.employment_id),personId=num(r.person_id);if(!employmentId||!personId)return[];const account=str(r.account_status);return[{employmentId,personId,teacherId:str(r.teacher_id)??"—",displayName:str(r.display_name)??"Teacher",nameNative:str(r.name_native),photoStoragePath:str(r.photo_storage_path),designation:str(r.designation)??"Teacher",designationKey:str(r.designation_key)??"teacher",joinedOn:str(r.joined_on)??"",state:str(r.state)??"active",email:str(r.email),phone:str(r.phone),accountStatus:(account==="active"||account==="disabled"||account==="not_created"||account==="email_required"?account:"not_created") as TeacherRow["accountStatus"],lastLogin:str(r.last_login),erpManaged:r.erp_managed===true,attendance:{total:num(r.attendance_total_30d)??0,present:num(r.attendance_present_30d)??0,absent:num(r.attendance_absent_30d)??0,late:num(r.attendance_late_30d)??0},assignedPrograms:assignments(r.assigned_programs),assignedSubjects:assignments(r.assigned_subjects),assignedGroups:assignments(r.assigned_groups),timetable:arr(r.timetable).flatMap((t)=>{const weekday=num(t.weekday),groupId=num(t.group_id),subjectId=num(t.subject_id),startsAt=str(t.starts_at),endsAt=str(t.ends_at);if(!weekday||!groupId||!subjectId||!startsAt||!endsAt)return[];return[{weekday,startsAt,endsAt,groupId,groupLabels:labels(t.group_labels),subjectId,subjectLabels:labels(t.subject_labels),room:str(t.room)}];})}];}) as TeacherRow[];
 return{canManage:raw.can_manage===true,teachers};
}

export async function getTeacherByEmploymentId(employmentId:number):Promise<{canManage:boolean;teacher:TeacherRow}|null>{
 const data=await getTeachersWorkspace();const teacher=data.teachers.find((row)=>row.employmentId===employmentId);return teacher?{canManage:data.canManage,teacher}:null;
}

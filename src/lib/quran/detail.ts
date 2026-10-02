import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";

type Raw=Record<string,unknown>;
const num=(v:unknown)=>v===null||v===undefined||v===""?null:Number.isFinite(Number(v))?Number(v):null;
const str=(v:unknown)=>typeof v==="string"?v:null;
const arr=(v:unknown)=>Array.isArray(v)?v:[];

export type QuranAttemptDetail={id:number;workCategory:string;outcome:string;targetLabel:string;accuracy:number|null;fluency:number|null;tajweed:number|null;overall:number|null;prompts:number|null;teacherRemark:string|null;parentRemark:string|null;privateNote:string|null;occurredAt:string;correctionId:number|null;correctionReason:string|null;correctedAt:string|null;mistakes:{category:string;severity:number;count:number;note:string|null}[]};
export type QuranStudentDetail={student:{personId:number;name:string;nameNative:string|null;studentNumber:string;groupName:string|null};summary:{attempts:number;averageScore:number|null;passed:number;repeat:number;openRevision:number;lastRecordedAt:string|null};juzWall:{juz:number;status:string;workCategory:string|null;score:number|null;recordedAt:string|null;correctionId:number|null}[];attempts:QuranAttemptDetail[];mistakeSummary:{category:string;totalCount:number;maxSeverity:number;sessions:number}[];revisions:{id:number;sourceType:string;sourceKey:string|null;dueOn:string;state:string;createdAt:string;completedByAttemptId:number|null}[];canCorrect:boolean};
export type QuranRevisionQueue={localDate:string|null;total:number;page:number;pageSize:number;rows:{id:number;studentPersonId:number;name:string;studentNumber:string;sourceType:string;sourceKey:string|null;dueOn:string;state:string;overdue:boolean;createdAt:string}[]};

export async function getQuranStudentDetail(personId:number):Promise<QuranStudentDetail>{
  const w=await getTenantContext();if(!w||!w.branchId)throw new Error("Active branch is required.");const admin=createAdminClient();
  const common={p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_student_person_id:personId};
  const [{data,error},{data:wallData,error:wallError}]=await Promise.all([
    admin.rpc("get_quran_student_detail_scoped_v1",{...common,p_limit:100}),
    admin.rpc("get_quran_juz_wall_scoped_v1",common)
  ]);
  if(error)throw new Error(`Unable to load Qur'an history: ${error.message}`);if(wallError)throw new Error(`Unable to load Hifz wall: ${wallError.message}`);
  const r=data&&typeof data==="object"&&!Array.isArray(data)?data as Raw:{};const s=r.student&&typeof r.student==="object"&&!Array.isArray(r.student)?r.student as Raw:{};const summary=r.summary&&typeof r.summary==="object"&&!Array.isArray(r.summary)?r.summary as Raw:{};
  if(!num(s.person_id))throw new Error("Student Qur'an record not found.");
  return {student:{personId:num(s.person_id)!,name:str(s.name)??"Student",nameNative:str(s.name_native),studentNumber:str(s.student_number)??"—",groupName:str(s.group_name)},summary:{attempts:num(summary.attempts)??0,averageScore:num(summary.average_score),passed:num(summary.passed)??0,repeat:num(summary.repeat)??0,openRevision:num(summary.open_revision)??0,lastRecordedAt:str(summary.last_recorded_at)},
    juzWall:arr(wallData).flatMap(x=>{if(!x||typeof x!=="object"||Array.isArray(x))return[];const o=x as Raw;const juz=num(o.juz);return juz?[{juz,status:str(o.status)??"not_started",workCategory:str(o.work_category),score:num(o.score),recordedAt:str(o.recorded_at),correctionId:num(o.correction_id)}]:[];}),
    attempts:arr(r.attempts).flatMap(x=>{if(!x||typeof x!=="object"||Array.isArray(x))return[];const o=x as Raw;const id=num(o.id);if(!id)return[];return[{id,workCategory:str(o.work_category)??"recitation",outcome:str(o.outcome)??"—",targetLabel:str(o.target_label)??"—",accuracy:num(o.accuracy_score),fluency:num(o.fluency_score),tajweed:num(o.tajweed_score),overall:num(o.overall_score),prompts:num(o.prompts),teacherRemark:str(o.teacher_remark),parentRemark:str(o.parent_visible_remark),privateNote:str(o.private_note),occurredAt:str(o.occurred_at)??"",correctionId:num(o.correction_id),correctionReason:str(o.correction_reason),correctedAt:str(o.corrected_at),mistakes:arr(o.mistakes).flatMap(m=>{if(!m||typeof m!=="object"||Array.isArray(m))return[];const z=m as Raw;return[{category:str(z.category)??"other",severity:num(z.severity)??1,count:num(z.count)??1,note:str(z.note)}];})}];}),
    mistakeSummary:arr(r.mistake_summary).flatMap(x=>{if(!x||typeof x!=="object"||Array.isArray(x))return[];const o=x as Raw;return[{category:str(o.category)??"other",totalCount:num(o.total_count)??0,maxSeverity:num(o.max_severity)??1,sessions:num(o.sessions)??0}];}),
    revisions:arr(r.revisions).flatMap(x=>{if(!x||typeof x!=="object"||Array.isArray(x))return[];const o=x as Raw;const id=num(o.id);if(!id)return[];return[{id,sourceType:str(o.source_type)??"teacher",sourceKey:str(o.source_key),dueOn:str(o.due_on)??"",state:str(o.state)??"due",createdAt:str(o.created_at)??"",completedByAttemptId:num(o.completed_by_attempt_id)}];}),canCorrect:r.can_correct===true};
}

export async function getQuranRevisionQueue(state:"open"|"completed"|"all",page:number):Promise<QuranRevisionQueue>{
  const w=await getTenantContext();if(!w||!w.branchId)throw new Error("Active branch is required.");const admin=createAdminClient();const {data,error}=await admin.rpc("get_quran_revision_queue_v2",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_state:state,p_page:page,p_page_size:50});if(error)throw new Error(`Unable to load revision queue: ${error.message}`);const r=data&&typeof data==="object"&&!Array.isArray(data)?data as Raw:{};
  return{localDate:str(r.local_date),total:num(r.total)??0,page:num(r.page)??1,pageSize:num(r.page_size)??50,rows:arr(r.rows).flatMap(x=>{if(!x||typeof x!=="object"||Array.isArray(x))return[];const o=x as Raw;const id=num(o.id),studentPersonId=num(o.student_person_id);if(!id||!studentPersonId)return[];return[{id,studentPersonId,name:str(o.name)??"Student",studentNumber:str(o.student_number)??"—",sourceType:str(o.source_type)??"teacher",sourceKey:str(o.source_key),dueOn:str(o.due_on)??"",state:str(o.state)??"due",overdue:o.overdue===true,createdAt:str(o.created_at)??""}];})};
}

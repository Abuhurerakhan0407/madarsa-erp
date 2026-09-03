import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";
import type { Locale } from "@/lib/i18n/config";

type Raw=Record<string,unknown>;
type Labels=Record<string,string>|null;
export type AcademicOption={id:number;key:string;label:string};
export type AcademicsWorkspace={
  localDate:string;selectedDate:string;timezone:string;
  permissions:{structureRead:boolean;timetableManage:boolean;homeworkRead:boolean;homeworkManage:boolean;calendarManage:boolean};
  sessions:Array<AcademicOption&{startsOn:string;endsOn:string;isDefault:boolean}>;
  programs:AcademicOption[];
  groups:Array<AcademicOption&{sessionId:number;programId:number;primaryTeacherPersonId:number|null}>;
  subjects:AcademicOption[];
  teachers:Array<{personId:number;name:string;nameNative:string|null;employeeNumber:string;designation:string}>;
  students:Array<{personId:number;name:string;nameNative:string|null;studentNumber:string;sessionId:number;programId:number;groupId:number|null;groupLabel:string}>;
  slots:Array<AcademicOption&{startsAt:string;endsAt:string;sequence:number}>;
  entries:Array<{id:number;sessionId:number;groupId:number;groupLabel:string;programId:number;slotId:number;slotLabel:string;startsAt:string;endsAt:string;subjectId:number|null;subjectLabel:string;teacherPersonId:number|null;teacherName:string;roomKey:string;weekday:number;effectiveFrom:string;effectiveTo:string|null;status:string}>;
  exceptions:Array<{id:number;entryId:number;sessionDate:string;action:string;replacementDate:string|null;replacementSlotId:number|null;replacementTeacherPersonId:number|null;replacementTeacherName:string;replacementRoomKey:string;note:string}>;
  homework:Array<{id:number;sessionId:number;groupId:number|null;groupLabel:string;studentPersonId:number|null;studentName:string;subjectId:number|null;subjectLabel:string;teacherPersonId:number;teacherName:string;title:string;instructions:string;assignedAt:string|null;dueAt:string;allowSubmission:boolean;state:string;priority:string;parentVisible:boolean;studentVisible:boolean;attachmentStoragePath:string|null}>;
  calendar:Array<{id:number;sessionId:number;eventType:string;label:string;startsAt:string;endsAt:string;description:string;location:string;audience:string;priority:string;affectsAttendance:boolean;attachmentStoragePath:string|null;status:string}>;
  todaySchedule:Array<{entryId:number;exceptionId:number|null;occurrenceType:string;sessionId:number;groupId:number;groupLabel:string;programId:number;subjectId:number|null;subjectLabel:string;teacherPersonId:number|null;teacherName:string;roomKey:string;slotId:number;slotLabel:string;startsAt:string;endsAt:string}>;
  closure:null|{id:number;eventType:string;label:string;startsAt:string;endsAt:string;description:string;location:string;audience:string;priority:string;affectsAttendance:boolean};
  summary:{todayLessons:number;activeSlots:number;activeEntries:number;openHomework:number;calendarItems:number;closedForAttendance:boolean};
};

function obj(value:unknown):Raw|null{return value&&typeof value==="object"&&!Array.isArray(value)?value as Raw:null;}
function str(value:unknown,fallback=""):string{return typeof value==="string"?value:fallback;}
function num(value:unknown):number|null{if(value===null||value===undefined||value==="")return null;const n=Number(value);return Number.isFinite(n)?n:null;}
function labelsValue(value:unknown):Labels{const raw=obj(value);if(!raw)return null;const result:Record<string,string>={};for(const [key,item] of Object.entries(raw))if(typeof item==="string"&&item.trim())result[key]=item;return result;}
function localized(value:unknown,locale:Locale,fallback=""):string{const labels=labelsValue(value);return labels?.[locale]||labels?.en||Object.values(labels??{})[0]||fallback;}
function list(value:unknown):Raw[]{return Array.isArray(value)?value.flatMap((item)=>{const row=obj(item);return row?[row]:[];}):[];}

export async function getAcademicsWorkspace(locale:Locale,date?:string|null):Promise<AcademicsWorkspace>{
  const workspace=await getTenantContext();
  if(!workspace||!workspace.branchId)throw new Error("Active branch is required for Academics & Timetable.");
  const admin=createAdminClient();
  const [workspaceResult,studentsResult]=await Promise.all([
    admin.rpc("get_academics_timetable_workspace_v1",{p_identity_id:workspace.identityId,p_tenant_id:workspace.tenantId,p_branch_id:workspace.branchId,p_selected_date:date??null}),
    admin.rpc("get_academics_timetable_students_v1",{p_identity_id:workspace.identityId,p_tenant_id:workspace.tenantId,p_branch_id:workspace.branchId})
  ]);
  if(workspaceResult.error)throw new Error(`Unable to load Academics & Timetable: ${workspaceResult.error.message}`);
  if(studentsResult.error)throw new Error(`Unable to load academic student roster: ${studentsResult.error.message}`);
  const raw=obj(workspaceResult.data)??{};const permissions=obj(raw.permissions)??{};const summary=obj(raw.summary)??{};
  const mapOption=(row:Raw,fallback:string):AcademicOption|null=>{const id=num(row.id);if(!id)return null;return{id,key:str(row.key,String(id)),label:localized(row.labels,locale,`${fallback} ${id}`)}};

  const sessions=list(raw.sessions).flatMap((row)=>{const base=mapOption(row,"Session");return base?[{...base,startsOn:str(row.starts_on),endsOn:str(row.ends_on),isDefault:row.is_default===true}]:[];});
  const programs=list(raw.programs).flatMap((row)=>{const base=mapOption(row,"Program");return base?[base]:[];});
  const groups=list(raw.groups).flatMap((row)=>{const base=mapOption(row,"Group"),sessionId=num(row.session_id),programId=num(row.program_id);return base&&sessionId&&programId?[{...base,sessionId,programId,primaryTeacherPersonId:num(row.primary_teacher_person_id)}]:[];});
  const subjects=list(raw.subjects).flatMap((row)=>{const base=mapOption(row,"Subject");return base?[base]:[];});
  const teachers=list(raw.teachers).flatMap((row)=>{const personId=num(row.person_id);return personId?[{personId,name:str(row.name,`Teacher ${personId}`),nameNative:str(row.name_native)||null,employeeNumber:str(row.employee_number),designation:str(row.designation)}]:[];});
  const slots=list(raw.slots).flatMap((row)=>{const base=mapOption(row,"Slot");return base?[{...base,startsAt:str(row.starts_at),endsAt:str(row.ends_at),sequence:num(row.sequence)??0}]:[];});
  const entries=list(raw.entries).flatMap((row)=>{const id=num(row.id),sessionId=num(row.session_id),groupId=num(row.group_id),programId=num(row.program_id),slotId=num(row.slot_id);return id&&sessionId&&groupId&&programId&&slotId?[{id,sessionId,groupId,groupLabel:localized(row.group_labels,locale,`Group ${groupId}`),programId,slotId,slotLabel:localized(row.slot_labels,locale,`Slot ${slotId}`),startsAt:str(row.starts_at),endsAt:str(row.ends_at),subjectId:num(row.subject_id),subjectLabel:localized(row.subject_labels,locale,str(row.subject_key,"—")),teacherPersonId:num(row.teacher_person_id),teacherName:str(row.teacher_name,"—"),roomKey:str(row.room_key),weekday:num(row.weekday)??1,effectiveFrom:str(row.effective_from),effectiveTo:str(row.effective_to)||null,status:str(row.status)}]:[];});
  const exceptions=list(raw.exceptions).flatMap((row)=>{const id=num(row.id),entryId=num(row.timetable_entry_id);return id&&entryId?[{id,entryId,sessionDate:str(row.session_date),action:str(row.action),replacementDate:str(row.replacement_date)||null,replacementSlotId:num(row.replacement_slot_id),replacementTeacherPersonId:num(row.replacement_teacher_person_id),replacementTeacherName:str(row.replacement_teacher_name),replacementRoomKey:str(row.replacement_room_key),note:str(row.note)}]:[];});
  const homework=list(raw.homework).flatMap((row)=>{const id=num(row.id),sessionId=num(row.academic_session_id),teacherPersonId=num(row.teacher_person_id);return id&&sessionId&&teacherPersonId?[{id,sessionId,groupId:num(row.group_id),groupLabel:localized(row.group_labels,locale),studentPersonId:num(row.student_person_id),studentName:str(row.student_name),subjectId:num(row.subject_id),subjectLabel:localized(row.subject_labels,locale,"—"),teacherPersonId,teacherName:str(row.teacher_name,"—"),title:str(row.title),instructions:str(row.instructions),assignedAt:str(row.assigned_at)||null,dueAt:str(row.due_at),allowSubmission:row.allow_submission===true,state:str(row.state),priority:str(row.priority,"normal"),parentVisible:row.parent_visible===true,studentVisible:row.student_visible===true,attachmentStoragePath:str(row.attachment_storage_path)||null}]:[];});
  const calendar=list(raw.calendar).flatMap((row)=>{const id=num(row.id),sessionId=num(row.session_id);return id&&sessionId?[{id,sessionId,eventType:str(row.event_type),label:localized(row.labels,locale,`Event ${id}`),startsAt:str(row.starts_at),endsAt:str(row.ends_at),description:str(row.description),location:str(row.location),audience:str(row.audience,"all"),priority:str(row.priority,"normal"),affectsAttendance:row.affects_attendance===true,attachmentStoragePath:str(row.attachment_storage_path)||null,status:str(row.status)}]:[];});
  const todaySchedule=list(raw.today_schedule).flatMap((row)=>{const entryId=num(row.entry_id),sessionId=num(row.session_id),groupId=num(row.group_id),programId=num(row.program_id),slotId=num(row.slot_id);return entryId&&sessionId&&groupId&&programId&&slotId?[{entryId,exceptionId:num(row.exception_id),occurrenceType:str(row.occurrence_type,"scheduled"),sessionId,groupId,groupLabel:localized(row.group_labels,locale,`Group ${groupId}`),programId,subjectId:num(row.subject_id),subjectLabel:localized(row.subject_labels,locale,str(row.subject_key,"—")),teacherPersonId:num(row.teacher_person_id),teacherName:str(row.teacher_name,"—"),roomKey:str(row.room_key),slotId,slotLabel:localized(row.slot_labels,locale,`Slot ${slotId}`),startsAt:str(row.starts_at),endsAt:str(row.ends_at)}]:[];});
  const closureRaw=obj(raw.closure);const closure=closureRaw&&num(closureRaw.id)?{id:num(closureRaw.id)!,eventType:str(closureRaw.event_type),label:localized(closureRaw.labels,locale,"Closure"),startsAt:str(closureRaw.starts_at),endsAt:str(closureRaw.ends_at),description:str(closureRaw.description),location:str(closureRaw.location),audience:str(closureRaw.audience,"all"),priority:str(closureRaw.priority,"normal"),affectsAttendance:closureRaw.affects_attendance===true}:null;
  const students=list(studentsResult.data).flatMap((row)=>{const personId=num(row.person_id),sessionId=num(row.session_id),programId=num(row.program_id);return personId&&sessionId&&programId?[{personId,name:str(row.name,`Student ${personId}`),nameNative:str(row.name_native)||null,studentNumber:str(row.student_number,"—"),sessionId,programId,groupId:num(row.group_id),groupLabel:localized(row.group_labels,locale)}]:[];});

  return{
    localDate:str(raw.local_date,new Date().toISOString().slice(0,10)),selectedDate:str(raw.selected_date,str(raw.local_date,new Date().toISOString().slice(0,10))),timezone:str(raw.timezone,"Asia/Kolkata"),
    permissions:{structureRead:permissions.structure_read===true,timetableManage:permissions.timetable_manage===true,homeworkRead:permissions.homework_read===true,homeworkManage:permissions.homework_manage===true,calendarManage:permissions.calendar_manage===true},
    sessions,programs,groups,subjects,teachers,students,slots,entries,exceptions,homework,calendar,todaySchedule,closure,
    summary:{todayLessons:num(summary.today_lessons)??0,activeSlots:num(summary.active_slots)??0,activeEntries:num(summary.active_timetable_entries)??0,openHomework:num(summary.open_homework)??0,calendarItems:num(summary.calendar_items)??0,closedForAttendance:summary.closed_for_attendance===true}
  };
}

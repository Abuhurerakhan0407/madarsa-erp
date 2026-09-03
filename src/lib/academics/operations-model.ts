export const academicActions = [
  "create_slot",
  "create_timetable_entry",
  "create_exception",
  "archive_timetable_entry",
  "create_homework",
  "set_homework_state",
  "create_calendar_event",
  "set_calendar_status"
] as const;

export type AcademicAction = (typeof academicActions)[number];
export type LocalizedLabels = { en: string; ur?: string; ar?: string };
export type AcademicMutation =
  | { action:"create_slot"; key:string; labels:LocalizedLabels; startsAt:string; endsAt:string; sequence:number }
  | { action:"create_timetable_entry"; groupId:number; slotId:number; subjectId:number; teacherPersonId:number|null; roomKey:string; weekday:number; effectiveFrom:string; effectiveTo:string|null }
  | { action:"create_exception"; entryId:number; sessionDate:string; exceptionAction:"cancel"|"substitute"|"reschedule"; replacementDate:string|null; replacementSlotId:number|null; replacementTeacherPersonId:number|null; replacementRoomKey:string; note:string }
  | { action:"archive_timetable_entry"; entryId:number }
  | { action:"create_homework"; sessionId:number; groupId:number|null; studentPersonId:number|null; subjectId:number; teacherPersonId:number; title:string; instructions:string; dueAt:string; priority:"low"|"normal"|"high"|"urgent"; parentVisible:boolean; studentVisible:boolean; allowSubmission:boolean; publish:boolean; attachmentToken:string|null }
  | { action:"set_homework_state"; homeworkId:number; state:"published"|"closed"|"cancelled" }
  | { action:"create_calendar_event"; sessionId:number; eventType:"working_day"|"holiday"|"event"|"exam_window"|"closure"; labels:LocalizedLabels; startsAt:string; endsAt:string; description:string; location:string; audience:"all"|"parents"|"students"|"teachers"|"staff"; priority:"low"|"normal"|"high"|"urgent"; affectsAttendance:boolean; attachmentToken:string|null }
  | { action:"set_calendar_status"; eventId:number; status:"active"|"cancelled" };

const DATE=/^\d{4}-\d{2}-\d{2}$/;
const DATETIME=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
const TIME=/^([01]\d|2[0-3]):[0-5]\d$/;
const KEY=/^[a-z0-9][a-z0-9_-]{0,63}$/;
const TOKEN=/^[A-Za-z0-9_-]{32,96}$/;
const PRIORITIES=["low","normal","high","urgent"] as const;

function record(value:unknown):Record<string,unknown>|null{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;}
function positive(value:unknown):number|null{return Number.isInteger(value)&&Number(value)>0?Number(value):null;}
function nullablePositive(value:unknown):number|null|undefined{if(value===null||value===""||value===undefined)return null;return positive(value)??undefined;}
function text(value:unknown,max:number,min=0):string|null{if(typeof value!=="string")return null;const clean=value.trim();return clean.length>=min&&clean.length<=max?clean:null;}
function bool(value:unknown,fallback:boolean):boolean|null{return value===undefined?fallback:typeof value==="boolean"?value:null;}
function enumValue<T extends readonly string[]>(value:unknown,values:T):T[number]|null{return typeof value==="string"&&values.includes(value as T[number])?value as T[number]:null;}
function only(input:Record<string,unknown>,allowed:readonly string[]):boolean{return Object.keys(input).every((key)=>allowed.includes(key));}
function date(value:unknown):string|null{if(typeof value!=="string"||!DATE.test(value))return null;const parsed=new Date(`${value}T00:00:00.000Z`);return !Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value?value:null;}
function datetime(value:unknown):string|null{if(typeof value!=="string"||!DATETIME.test(value))return null;const parsed=new Date(`${value}Z`);return Number.isNaN(parsed.valueOf())?null:value;}
function token(value:unknown):string|null{if(value===null||value===""||value===undefined)return null;return typeof value==="string"&&TOKEN.test(value)?value:null;}
function labels(value:unknown,max=160):LocalizedLabels|null{const input=record(value);if(!input)return null;const en=text(input.en,max,2);const ur=typeof input.ur==="string"?text(input.ur,max):"";const ar=typeof input.ar==="string"?text(input.ar,max):"";if(!en||ur===null||ar===null)return null;return {en,...(ur?{ur}:{}),...(ar?{ar}:{})};}
function result<T extends AcademicMutation>(value:T|null,errors:string[]){return value&&errors.length===0?{value,errors:[]}:{errors};}

export function validateAcademicMutation(body:unknown):{value?:AcademicMutation;errors:string[]}{
  const input=record(body);if(!input)return {errors:["Request body must be an object."]};
  const action=typeof input.action==="string"?input.action:"";

  if(action==="create_slot"){
    const errors:string[]=[];const key=typeof input.key==="string"?input.key.trim().toLowerCase():"";const l=labels(input.labels,120);
    const startsAt=typeof input.startsAt==="string"&&TIME.test(input.startsAt)?input.startsAt:null;const endsAt=typeof input.endsAt==="string"&&TIME.test(input.endsAt)?input.endsAt:null;
    const sequence=Number.isInteger(input.sequence)&&Number(input.sequence)>=0&&Number(input.sequence)<=200?Number(input.sequence):null;
    if(!only(input,["action","key","labels","startsAt","endsAt","sequence"]))errors.push("Timetable slot contains unsupported fields.");
    if(!KEY.test(key))errors.push("Timetable slot key is invalid.");if(!l)errors.push("Timetable slot labels are invalid.");if(!startsAt||!endsAt||endsAt<=startsAt)errors.push("Timetable slot times are invalid.");if(sequence===null)errors.push("Timetable slot sequence is invalid.");
    return result(errors.length?null:{action,key,labels:l!,startsAt:startsAt!,endsAt:endsAt!,sequence:sequence!},errors);
  }

  if(action==="create_timetable_entry"){
    const errors:string[]=[];const groupId=positive(input.groupId),slotId=positive(input.slotId),subjectId=positive(input.subjectId),teacherPersonId=nullablePositive(input.teacherPersonId);
    const weekday=Number.isInteger(input.weekday)&&Number(input.weekday)>=1&&Number(input.weekday)<=7?Number(input.weekday):null;const effectiveFrom=date(input.effectiveFrom);const effectiveTo=input.effectiveTo?date(input.effectiveTo):null;const roomKey=text(input.roomKey,80)??"";
    if(!only(input,["action","groupId","slotId","subjectId","teacherPersonId","roomKey","weekday","effectiveFrom","effectiveTo"]))errors.push("Timetable entry contains unsupported fields.");
    if(!groupId)errors.push("Academic group is required.");if(!slotId)errors.push("Timetable slot is required.");if(!subjectId)errors.push("Subject or component is required.");if(teacherPersonId===undefined)errors.push("Teacher selection is invalid.");if(!weekday)errors.push("Weekday is invalid.");if(!effectiveFrom)errors.push("Effective start date is invalid.");if(input.effectiveTo&&!effectiveTo)errors.push("Effective end date is invalid.");if(effectiveFrom&&effectiveTo&&effectiveTo<effectiveFrom)errors.push("Effective end date cannot be before start date.");
    return result(errors.length?null:{action,groupId:groupId!,slotId:slotId!,subjectId:subjectId!,teacherPersonId:teacherPersonId!,roomKey,weekday:weekday!,effectiveFrom:effectiveFrom!,effectiveTo},errors);
  }

  if(action==="create_exception"){
    const errors:string[]=[];const entryId=positive(input.entryId);const sessionDate=date(input.sessionDate);const exceptionAction=enumValue(input.exceptionAction,["cancel","substitute","reschedule"] as const);
    const replacementDate=input.replacementDate?date(input.replacementDate):null;const replacementSlotId=nullablePositive(input.replacementSlotId);const replacementTeacherPersonId=nullablePositive(input.replacementTeacherPersonId);const replacementRoomKey=text(input.replacementRoomKey,80)??"";const note=text(input.note,1000)??"";
    if(!only(input,["action","entryId","sessionDate","exceptionAction","replacementDate","replacementSlotId","replacementTeacherPersonId","replacementRoomKey","note"]))errors.push("Schedule exception contains unsupported fields.");
    if(!entryId)errors.push("Timetable entry is required.");if(!sessionDate)errors.push("Exception date is invalid.");if(!exceptionAction)errors.push("Exception action is invalid.");if(replacementSlotId===undefined||replacementTeacherPersonId===undefined)errors.push("Replacement selection is invalid.");
    if(exceptionAction==="substitute"&&replacementTeacherPersonId===null)errors.push("Substitute teacher is required.");
    if(exceptionAction==="reschedule"&&(!replacementDate||replacementSlotId===null))errors.push("Reschedule date and slot are required.");
    if(exceptionAction!=="reschedule"&&input.replacementDate)errors.push("Replacement date is only valid for rescheduling.");
    return result(errors.length?null:{action,entryId:entryId!,sessionDate:sessionDate!,exceptionAction:exceptionAction!,replacementDate,replacementSlotId:replacementSlotId!,replacementTeacherPersonId:replacementTeacherPersonId!,replacementRoomKey,note},errors);
  }

  if(action==="archive_timetable_entry"){
    const entryId=positive(input.entryId);const errors:string[]=[];if(!only(input,["action","entryId"]))errors.push("Archive request contains unsupported fields.");if(!entryId)errors.push("Timetable entry is required.");return result(errors.length?null:{action,entryId:entryId!},errors);
  }

  if(action==="create_homework"){
    const errors:string[]=[];const sessionId=positive(input.sessionId),groupId=nullablePositive(input.groupId),studentPersonId=nullablePositive(input.studentPersonId),subjectId=positive(input.subjectId),teacherPersonId=positive(input.teacherPersonId);const title=text(input.title,200,2),instructions=text(input.instructions,5000,2),dueAt=datetime(input.dueAt),priority=enumValue(input.priority??"normal",PRIORITIES);const parentVisible=bool(input.parentVisible,true),studentVisible=bool(input.studentVisible,true),allowSubmission=bool(input.allowSubmission,false),publish=bool(input.publish,false);const attachmentToken=token(input.attachmentToken);
    if(!only(input,["action","sessionId","groupId","studentPersonId","subjectId","teacherPersonId","title","instructions","dueAt","priority","parentVisible","studentVisible","allowSubmission","publish","attachmentToken"]))errors.push("Homework request contains unsupported fields.");
    if(!sessionId)errors.push("Academic session is required.");if(groupId===undefined||studentPersonId===undefined||Number(groupId!==null)+Number(studentPersonId!==null)!==1)errors.push("Choose exactly one group or student target.");if(!subjectId)errors.push("Homework subject is required.");if(!teacherPersonId)errors.push("Homework teacher is required.");if(!title)errors.push("Homework title is invalid.");if(!instructions)errors.push("Homework instructions are invalid.");if(!dueAt)errors.push("Homework due time is invalid.");if(!priority)errors.push("Homework priority is invalid.");if(parentVisible===null||studentVisible===null||allowSubmission===null||publish===null)errors.push("Homework visibility or publishing values are invalid.");if(input.attachmentToken&&!attachmentToken)errors.push("Homework attachment token is invalid.");
    return result(errors.length?null:{action,sessionId:sessionId!,groupId:groupId!,studentPersonId:studentPersonId!,subjectId:subjectId!,teacherPersonId:teacherPersonId!,title:title!,instructions:instructions!,dueAt:dueAt!,priority:priority!,parentVisible:parentVisible!,studentVisible:studentVisible!,allowSubmission:allowSubmission!,publish:publish!,attachmentToken},errors);
  }

  if(action==="set_homework_state"){
    const homeworkId=positive(input.homeworkId);const state=enumValue(input.state,["published","closed","cancelled"] as const);const errors:string[]=[];if(!only(input,["action","homeworkId","state"]))errors.push("Homework state request contains unsupported fields.");if(!homeworkId)errors.push("Homework assignment is required.");if(!state)errors.push("Homework state is invalid.");return result(errors.length?null:{action,homeworkId:homeworkId!,state:state!},errors);
  }

  if(action==="create_calendar_event"){
    const errors:string[]=[];const sessionId=positive(input.sessionId);const eventType=enumValue(input.eventType,["working_day","holiday","event","exam_window","closure"] as const);const l=labels(input.labels,180);const startsAt=datetime(input.startsAt),endsAt=datetime(input.endsAt);const description=text(input.description,4000)??"",location=text(input.location,240)??"";const audience=enumValue(input.audience??"all",["all","parents","students","teachers","staff"] as const);const priority=enumValue(input.priority??"normal",PRIORITIES);const affectsAttendance=bool(input.affectsAttendance,false);const attachmentToken=token(input.attachmentToken);
    if(!only(input,["action","sessionId","eventType","labels","startsAt","endsAt","description","location","audience","priority","affectsAttendance","attachmentToken"]))errors.push("Calendar request contains unsupported fields.");
    if(!sessionId)errors.push("Academic session is required.");if(!eventType)errors.push("Calendar event type is invalid.");if(!l)errors.push("Calendar event labels are invalid.");if(!startsAt||!endsAt||endsAt<=startsAt)errors.push("Calendar event times are invalid.");if(!audience)errors.push("Calendar audience is invalid.");if(!priority)errors.push("Calendar priority is invalid.");if(affectsAttendance===null)errors.push("Attendance impact is invalid.");if(input.description&&!description)errors.push("Calendar description is too long.");if(input.location&&!location)errors.push("Calendar location is too long.");if(input.attachmentToken&&!attachmentToken)errors.push("Calendar attachment token is invalid.");
    return result(errors.length?null:{action,sessionId:sessionId!,eventType:eventType!,labels:l!,startsAt:startsAt!,endsAt:endsAt!,description,location,audience:audience!,priority:priority!,affectsAttendance:affectsAttendance!,attachmentToken},errors);
  }

  if(action==="set_calendar_status"){
    const eventId=positive(input.eventId);const status=enumValue(input.status,["active","cancelled"] as const);const errors:string[]=[];if(!only(input,["action","eventId","status"]))errors.push("Calendar status request contains unsupported fields.");if(!eventId)errors.push("Calendar event is required.");if(!status)errors.push("Calendar status is invalid.");return result(errors.length?null:{action,eventId:eventId!,status:status!},errors);
  }

  return {errors:["Unsupported academic operation."]};
}

export const examEntryStatuses=["present","absent","exempt","incomplete","withheld"] as const;
export type ExamEntryStatus=(typeof examEntryStatuses)[number];
export type ExamWorkflowAction="calculate"|"approve"|"publish";

export type ExamMarkInput={examSubjectId:number;studentPersonId:number;entryStatus:ExamEntryStatus;rawMarks:number|null;comment:string|null};
export type ExamModerationInput={markEntryId:number;rawMarks:number;reason:string};
export type ExamWorkflowInput={examSeriesId:number;action:ExamWorkflowAction};

type Validation<T>={value?:T;errors:string[]};

function objectValue(input:unknown):Record<string,unknown>|null{return input&&typeof input==="object"&&!Array.isArray(input)?input as Record<string,unknown>:null;}
function positiveInteger(value:unknown):number|null{const n=typeof value==="number"?value:Number(value);return Number.isInteger(n)&&n>0?n:null;}
function optionalNumber(value:unknown):number|null{if(value===null||value===undefined||value==="")return null;const n=typeof value==="number"?value:Number(value);return Number.isFinite(n)?n:null;}
function text(value:unknown,max:number):string|null{if(typeof value!=="string")return null;const v=value.trim();return v?v.slice(0,max):null;}

export function validateExamMarkInput(input:unknown):Validation<ExamMarkInput>{
  const raw=objectValue(input);if(!raw)return{errors:["Request body must be an object."]};const errors:string[]=[];
  const examSubjectId=positiveInteger(raw.examSubjectId);if(!examSubjectId)errors.push("Valid exam subject is required.");
  const studentPersonId=positiveInteger(raw.studentPersonId);if(!studentPersonId)errors.push("Valid student is required.");
  const status=typeof raw.entryStatus==="string"?raw.entryStatus.trim().toLowerCase():"";if(!examEntryStatuses.includes(status as ExamEntryStatus))errors.push("Valid mark status is required.");
  const rawMarks=optionalNumber(raw.rawMarks);
  if(status==="present"&&(rawMarks===null||rawMarks<0||rawMarks>10000))errors.push("Marks must be a non-negative number.");
  if(status!=="present"&&rawMarks!==null)errors.push("Only present students can carry marks.");
  const comment=typeof raw.comment==="string"?raw.comment.trim():"";if(comment.length>500)errors.push("Comment is too long.");
  if(errors.length||!examSubjectId||!studentPersonId||!examEntryStatuses.includes(status as ExamEntryStatus))return{errors};
  return{errors,value:{examSubjectId,studentPersonId,entryStatus:status as ExamEntryStatus,rawMarks,comment:text(raw.comment,500)}};
}

export function validateExamModerationInput(input:unknown):Validation<ExamModerationInput>{
  const raw=objectValue(input);if(!raw)return{errors:["Request body must be an object."]};const errors:string[]=[];
  const markEntryId=positiveInteger(raw.markEntryId);if(!markEntryId)errors.push("Valid mark entry is required.");
  const rawMarks=optionalNumber(raw.rawMarks);if(rawMarks===null||rawMarks<0||rawMarks>10000)errors.push("Valid moderated marks are required.");
  const reason=typeof raw.reason==="string"?raw.reason.trim():"";if(reason.length<4)errors.push("Moderation reason must be at least 4 characters.");if(reason.length>500)errors.push("Moderation reason is too long.");
  if(errors.length||!markEntryId||rawMarks===null)return{errors};return{errors,value:{markEntryId,rawMarks,reason}};
}

export function validateExamWorkflowInput(input:unknown):Validation<ExamWorkflowInput>{
  const raw=objectValue(input);if(!raw)return{errors:["Request body must be an object."]};const errors:string[]=[];
  const examSeriesId=positiveInteger(raw.examSeriesId);if(!examSeriesId)errors.push("Valid exam series is required.");
  const action=typeof raw.action==="string"?raw.action.trim().toLowerCase():"";if(!(["calculate","approve","publish"] as string[]).includes(action))errors.push("Valid workflow action is required.");
  if(errors.length||!examSeriesId)return{errors};return{errors,value:{examSeriesId,action:action as ExamWorkflowAction}};
}

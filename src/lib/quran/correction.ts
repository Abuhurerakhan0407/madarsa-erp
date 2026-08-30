import type { QuranOutcome } from "./model";

export type QuranCorrectionInput={
  requestKey:string;
  attemptId:number;
  reason:string;
  accuracyScore:number|null;
  fluencyScore:number|null;
  tajweedScore:number|null;
  overallScore:number|null;
  prompts:number|null;
  outcome:QuranOutcome;
  teacherRemark:string|null;
  parentVisibleRemark:string|null;
  privateNote:string|null;
};

type Result={value?:QuranCorrectionInput;errors:string[]};
const OUTCOMES=new Set<QuranOutcome>(["passed","partial","repeat","excused","not_attempted"]);

function objectValue(value:unknown):Record<string,unknown>|null{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;}
function text(value:unknown,max:number):string|null{if(value===null||value===undefined)return null;if(typeof value!=="string")return null;const clean=value.trim();return clean&&clean.length<=max?clean:null;}
function nullableScore(value:unknown):number|null|undefined{if(value===null||value===undefined||value==="")return null;const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=100?n:undefined;}

export function validateQuranCorrectionInput(input:unknown):Result{
  const data=objectValue(input);if(!data)return{errors:["Request body must be an object."]};
  const errors:string[]=[];
  const requestKey=typeof data.requestKey==="string"?data.requestKey.trim():"";
  if(requestKey.length<16||requestKey.length>96)errors.push("Request key is invalid.");
  const attemptId=Number(data.attemptId);if(!Number.isInteger(attemptId)||attemptId<1)errors.push("Recitation attempt is required.");
  const reason=text(data.reason,500);if(!reason||reason.length<5)errors.push("Correction reason must be at least 5 characters.");
  const outcome=typeof data.outcome==="string"&&OUTCOMES.has(data.outcome as QuranOutcome)?data.outcome as QuranOutcome:undefined;if(!outcome)errors.push("Outcome is invalid.");
  const accuracyScore=nullableScore(data.accuracyScore),fluencyScore=nullableScore(data.fluencyScore),tajweedScore=nullableScore(data.tajweedScore),overallScore=nullableScore(data.overallScore);
  for(const [label,parsed] of [["Accuracy",accuracyScore],["Fluency",fluencyScore],["Tajweed",tajweedScore],["Overall",overallScore]] as const)if(parsed===undefined)errors.push(`${label} score must be between 0 and 100.`);
  let prompts:number|null=null;if(data.prompts!==null&&data.prompts!==undefined&&data.prompts!==""){const n=Number(data.prompts);if(!Number.isInteger(n)||n<0||n>999)errors.push("Prompts must be a non-negative whole number.");else prompts=n;}
  const teacherRemark=text(data.teacherRemark,1000),parentVisibleRemark=text(data.parentVisibleRemark,1000),privateNote=text(data.privateNote,1000);
  for(const [label,raw,parsed] of [["Teacher remark",data.teacherRemark,teacherRemark],["Parent remark",data.parentVisibleRemark,parentVisibleRemark],["Private note",data.privateNote,privateNote]] as const)if(typeof raw==="string"&&raw.trim()&&parsed===null)errors.push(`${label} is too long.`);
  if(errors.length||!reason||!outcome||!Number.isInteger(attemptId)||attemptId<1||accuracyScore===undefined||fluencyScore===undefined||tajweedScore===undefined||overallScore===undefined)return{errors};
  return{errors:[],value:{requestKey,attemptId,reason,accuracyScore,fluencyScore,tajweedScore,overallScore,prompts,outcome,teacherRemark,parentVisibleRemark,privateNote}};
}

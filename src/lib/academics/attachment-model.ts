export type AcademicAttachmentKind="homework"|"calendar";
export type AcademicAttachmentType="application/pdf"|"image/jpeg"|"image/png"|"image/webp";

export const MAX_ACADEMIC_ATTACHMENT_BYTES=8*1024*1024;
export const academicAttachmentExtensions=new Map<AcademicAttachmentType,string>([
  ["application/pdf","pdf"],["image/jpeg","jpg"],["image/png","png"],["image/webp","webp"]
]);

function has(bytes:Uint8Array,offset:number,values:readonly number[]):boolean{return values.every((value,index)=>bytes[offset+index]===value);}
export function detectAcademicAttachmentType(bytes:Uint8Array):AcademicAttachmentType|null{
  if(bytes.length>=5&&has(bytes,0,[37,80,68,70,45]))return "application/pdf";
  if(bytes.length>=3&&has(bytes,0,[255,216,255]))return "image/jpeg";
  if(bytes.length>=8&&has(bytes,0,[137,80,78,71,13,10,26,10]))return "image/png";
  if(bytes.length>=12&&has(bytes,0,[82,73,70,70])&&has(bytes,8,[87,69,66,80]))return "image/webp";
  return null;
}
export function isAcademicAttachmentKind(value:unknown):value is AcademicAttachmentKind{return value==="homework"||value==="calendar";}

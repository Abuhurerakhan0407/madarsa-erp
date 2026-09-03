import { createLayoutPdf, type PdfLayoutCommand } from "../documents/layout-pdf";
import { operationalReportKeys } from "./model";
import type { ReportResult } from "./workspace";

type ReportPdfContext = { institutionName: string; branchName: string };
const PAGE_WIDTH=842,PAGE_HEIGHT=595,LEFT=28,TOP=548,ROW_HEIGHT=19,HEADER_HEIGHT=23,ROWS_PER_PAGE=24,TABLE_WIDTH=786;
const titles:Record<string,string>={daily_attendance:'Attendance',student_strength:'Student strength',teacher_attendance:'Teacher attendance',quran_progress:'Qur’an / Hifz progress',program_progress:'Program progress',exam_performance:'Exam performance',absence_trend:'Absence trend',late_trend:'Late trend',new_admissions:'New admissions',group_program_comparison:'Group / program comparison'};
function stringValue(value:unknown):string{if(value===null||value===undefined||value==='')return'-';if(typeof value==='object')return JSON.stringify(value);return String(value);}
function fit(value:unknown,maxChars:number):string{const valueText=stringValue(value).replace(/\s+/g,' ').trim();return valueText.length<=maxChars?valueText:`${valueText.slice(0,Math.max(1,maxChars-3))}...`;}
const titleize=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());
function text(x:number,y:number,value:string,size=7,bold=false):PdfLayoutCommand{return{type:'text',x,y,text:value,size,bold};}
export function createOperationalReportPdf(result:ReportResult,context:ReportPdfContext):Uint8Array{
 if(!supportsOperationalReportPdf(result.reportKey))throw new Error('PDF output is not supported for this report.');
 const columns=result.columns.length?result.columns:[];const displayColumns=columns.slice(0,10);const width=displayColumns.length?TABLE_WIDTH/displayColumns.length:TABLE_WIDTH;const maxChars=Math.max(8,Math.floor(width/4.8));
 const totalPages=Math.max(1,Math.ceil(result.rows.length/ROWS_PER_PAGE));const pages:PdfLayoutCommand[][]=[];
 for(let pageIndex=0;pageIndex<totalPages;pageIndex+=1){
  const commands:PdfLayoutCommand[]=[text(LEFT,570,context.institutionName,12,true),text(LEFT,556,`${titles[result.reportKey]} · ${context.branchName}`,9,true),text(690,570,`Run #${result.runId}`,7),text(690,556,`Page ${pageIndex+1}/${totalPages}`,7),{type:'rect',x:LEFT,y:TOP-HEADER_HEIGHT+2,width:TABLE_WIDTH,height:HEADER_HEIGHT,lineWidth:.8}];
  displayColumns.forEach((column,index)=>commands.push(text(LEFT+index*width+4,TOP-13,fit(titleize(column),maxChars),6.3,true)));
  result.rows.slice(pageIndex*ROWS_PER_PAGE,(pageIndex+1)*ROWS_PER_PAGE).forEach((row,rowIndex)=>{const y=TOP-HEADER_HEIGHT-(rowIndex+1)*ROW_HEIGHT+5;commands.push({type:'rect',x:LEFT,y:y-5,width:TABLE_WIDTH,height:ROW_HEIGHT,lineWidth:.35});displayColumns.forEach((column,index)=>commands.push(text(LEFT+index*width+4,y+2,fit(row[column],maxChars),6.2)));});
  commands.push(text(LEFT,20,`${result.rowCount} rows · Generated from live operational report data`,6.5));pages.push(commands);
 }
 return createLayoutPdf({pages,pageWidth:PAGE_WIDTH,pageHeight:PAGE_HEIGHT});
}
export function supportsOperationalReportPdf(reportKey:string):boolean{return operationalReportKeys.includes(reportKey as typeof operationalReportKeys[number]);}

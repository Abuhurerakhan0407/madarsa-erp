import {createSimplePdf,type PdfTextLine} from './simple-pdf';
export type ClientDocumentPdfEntry={heading:string;subheading?:string|null;fields:Array<{label:string;value:string|number|null|undefined}>;details?:string[];footer?:string|null};
const value=(input:string|number|null|undefined)=>input===null||input===undefined||input===''?'—':String(input);
export function createClientDocumentPdf(title:string,institutionName:string,branchName:string,entries:ClientDocumentPdfEntry[]):Uint8Array{
 if(!entries.length)throw new Error('At least one document is required.');const lines:PdfTextLine[]=[];
 entries.forEach((entry,index)=>{lines.push({text:institutionName,size:14,bold:true,pageBreakBefore:index>0},{text:branchName,size:9,gapAfter:4},{text:entry.heading,size:16,bold:true},{text:entry.subheading||title,size:10,gapAfter:8});entry.fields.forEach(field=>lines.push({text:`${field.label}: ${value(field.value)}`,bold:field.label==='Student'||field.label==='Student ID'}));if(entry.details?.length){lines.push({text:'Details',size:11,bold:true,gapAfter:2});entry.details.forEach(detail=>lines.push({text:detail}));}if(entry.footer)lines.push({text:'',gapAfter:3},{text:entry.footer,size:8});});
 return createSimplePdf({title,lines});
}

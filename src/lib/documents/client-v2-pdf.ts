import {createStructuredDocumentPdf,createStructuredUnicodeDocumentPdf,type StructuredDocumentField} from './document-template';

export type ClientDocumentPdfEntry={heading:string;subheading?:string|null;fields:Array<{label:string;value:string|number|null|undefined}>;details?:string[];footer?:string|null};

function options(title:string,institutionName:string,branchName:string,entries:ClientDocumentPdfEntry[]){
 if(!entries.length)throw new Error('At least one document is required.');
 return{
  title,
  institutionName,
  branchName,
  documents:entries.map(entry=>({
   heading:entry.heading,
   subheading:entry.subheading,
   fields:entry.fields as StructuredDocumentField[],
   details:entry.details,
   footer:entry.footer
  }))
 };
}

export function createClientDocumentPdf(title:string,institutionName:string,branchName:string,entries:ClientDocumentPdfEntry[]):Uint8Array{
 return createStructuredDocumentPdf(options(title,institutionName,branchName,entries));
}

export async function createClientDocumentUnicodePdf(title:string,institutionName:string,branchName:string,entries:ClientDocumentPdfEntry[]):Promise<Uint8Array>{
 return createStructuredUnicodeDocumentPdf(options(title,institutionName,branchName,entries));
}

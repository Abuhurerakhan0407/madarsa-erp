import {createStructuredDocumentPdf,type StructuredDocumentField} from './document-template';

export type ClientDocumentPdfEntry={heading:string;subheading?:string|null;fields:Array<{label:string;value:string|number|null|undefined}>;details?:string[];footer?:string|null};

export function createClientDocumentPdf(title:string,institutionName:string,branchName:string,entries:ClientDocumentPdfEntry[]):Uint8Array{
 if(!entries.length)throw new Error('At least one document is required.');
 return createStructuredDocumentPdf({
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
 });
}

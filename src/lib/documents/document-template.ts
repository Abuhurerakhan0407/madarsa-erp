import {createLayoutPdf,type PdfLayoutCommand} from './layout-pdf';
import {createUnicodeLayoutPdf} from './unicode-layout-pdf';

export type StructuredDocumentField={label:string;value:string|number|null|undefined};
export type StructuredDocumentPage={heading:string;subheading?:string|null;fields:StructuredDocumentField[];details?:string[];footer?:string|null};

type TemplateOptions={title:string;institutionName:string;branchName:string;documents:StructuredDocumentPage[]};

const text=(x:number,y:number,value:string,size=10,bold=false):PdfLayoutCommand=>({type:'text',x,y,text:value,size,bold});
const value=(input:string|number|null|undefined)=>input===null||input===undefined||input===''?'—':String(input);
function fit(input:string|number|null|undefined,max:number){const normalized=value(input).replace(/\s+/g,' ').trim();return normalized.length<=max?normalized:`${normalized.slice(0,Math.max(1,max-3))}...`;}

function page(options:TemplateOptions,document:StructuredDocumentPage):PdfLayoutCommand[]{
 const commands:PdfLayoutCommand[]=[
  {type:'rect',x:32,y:32,width:531,height:778,lineWidth:1.25},
  {type:'rect',x:41,y:41,width:513,height:760,lineWidth:0.4},
  text(52,782,fit(options.institutionName,58),17,true),
  text(52,760,fit(options.branchName,68),9),
  text(52,721,fit(options.title,66),9,true),
  text(52,690,fit(document.heading,48),19,true),
  text(52,667,fit(document.subheading||options.title,72),10)
 ];
 const left=52,right=302,boxWidth=240,rowHeight=54,fieldTop=625;
 document.fields.forEach((field,index)=>{
  const column=index%2;const row=Math.floor(index/2);const x=column?right:left;const y=fieldTop-row*rowHeight;
  commands.push({type:'rect',x,y:y-37,width:boxWidth,height:43,lineWidth:0.45});
  commands.push(text(x+10,y-9,fit(field.label,31),7,true));
  commands.push(text(x+10,y-27,fit(field.value,34),9));
 });
 const fieldRows=Math.ceil(document.fields.length/2);
 let cursor=fieldTop-fieldRows*rowHeight-2;
 const details=document.details?.filter(Boolean)??[];
 if(details.length){
  commands.push(text(52,cursor,'Details',10,true));cursor-=22;
  const visible=details.slice(0,14);
  visible.forEach((detail,index)=>{commands.push(text(60,cursor,`${index+1}. ${fit(detail,82)}`,8));cursor-=17;});
  if(details.length>visible.length)commands.push(text(60,cursor,`+ ${details.length-visible.length} more records`,8,true));
 }
 if(document.footer){commands.push(text(52,78,fit(document.footer,90),7));}
 commands.push(text(475,58,'Ilmgaah',7,true));
 return commands;
}

function pages(options:TemplateOptions):PdfLayoutCommand[][]{
 if(!options.documents.length)throw new Error('At least one document is required.');
 return options.documents.map(document=>page(options,document));
}

export function createStructuredDocumentPdf(options:TemplateOptions):Uint8Array{
 return createLayoutPdf({pages:pages(options)});
}

export async function createStructuredUnicodeDocumentPdf(options:TemplateOptions):Promise<Uint8Array>{
 return createUnicodeLayoutPdf({pages:pages(options)});
}

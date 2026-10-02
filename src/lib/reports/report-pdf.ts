import { createLayoutPdf, type PdfLayoutCommand } from "../documents/layout-pdf";
import { createUnicodeLayoutPdf } from "../documents/unicode-layout-pdf";
import { supportedOperationalReports } from "./model";
import type { ReportResult } from "./workspace";

type ReportPdfContext = { institutionName: string; branchName: string };
type ColumnConfig = { key: string; label: string; width: number; maxChars: number };

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const LEFT = 28;
const TABLE_WIDTH = 786;
const TOP = 518;
const ROW_HEIGHT = 20;
const HEADER_HEIGHT = 24;
const ROWS_PER_PAGE = 23;
const supported = new Set<string>(supportedOperationalReports);

const columnLabels:Record<string,string>={
 attendance_date:"Date",student_number:"Student ID",name:"Name",program:"Program",class_group:"Class / group",status:"Status",source:"Source",marked_at:"Marked",
 academic_session:"Academic year",students:"Students",capacity:"Capacity",utilization_pct:"Utilization",
 teacher_id:"Teacher ID",teacher_name:"Teacher",designation:"Designation",check_in:"Check in",check_out:"Check out",
 latest_category:"Latest category",latest_portion:"Latest portion",latest_score:"Latest score",latest_outcome:"Outcome",attempts:"Attempts",revision_due:"Revision due",
 student_name:"Student",component:"Component",unit:"Unit",state:"State",progress_method:"Method",progress_value:"Progress",occurred_at:"Recorded",
 exam:"Exam",subject:"Subject",marks:"Marks",maximum_marks:"Max marks",percentage:"Percentage",
 absent:"Absent",recorded:"Recorded",absence_rate:"Absence rate",late:"Late",late_rate:"Late rate",
 joined_on:"Joined",admission_number:"Admission no.",attendance_records:"Attendance",present:"Present",attendance_rate:"Attendance rate",progress_events:"Progress events",exam_average:"Exam average"
};

function titleize(value:string){return value.replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase());}
function stringValue(value: unknown): string {
 if (value === null || value === undefined || value === "") return "-";
 if (typeof value === "object") return JSON.stringify(value);
 return String(value);
}
function fit(value: unknown, maxChars: number): string {
 const text = stringValue(value).replace(/\s+/g, " ").trim();
 return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 3))}...`;
}
function text(x: number, y: number, value: string, size = 7, bold = false): PdfLayoutCommand {
 return { type: "text", x, y, text: value, size, bold };
}
function reportTitle(result:ReportResult){
 const english=result.labels?.en;
 return typeof english==="string"&&english.trim()?english:titleize(result.reportKey);
}
function reportMeta(result:ReportResult,generatedOn:string):string{
 const labels:Record<string,string>={date_from:"From",date_to:"To",program_id:"Program",group_id:"Group",student_person_id:"Student",teacher_person_id:"Teacher"};
 const filters=Object.entries(result.parameters).filter(([,value])=>value!==null&&value!==undefined&&value!=="").map(([key,value])=>`${labels[key]??titleize(key)}: ${String(value)}`);
 return [...filters,`Generated: ${generatedOn}`].join(" · ");
}
function configFor(result:ReportResult):{title:string;columns:ColumnConfig[]}{
 if(!supported.has(result.reportKey)) throw new Error("PDF output is not supported for this report.");
 const keys=result.columns.length?result.columns:Object.keys(result.rows[0]??{});
 if(!keys.length) return {title:reportTitle(result),columns:[]};
 const width=TABLE_WIDTH/keys.length;
 const maxChars=Math.max(7,Math.floor(width/4.7));
 return {
  title:reportTitle(result),
  columns:keys.map(key=>({key,label:columnLabels[key]??titleize(key),width,maxChars}))
 };
}
function pageHeader(config: { title: string; columns: ColumnConfig[] }, context: ReportPdfContext, result: ReportResult, page: number, totalPages: number, generatedOn:string): PdfLayoutCommand[] {
 const commands: PdfLayoutCommand[] = [
  text(LEFT, 570, context.institutionName, 12, true),
  text(LEFT, 556, `${config.title} · ${context.branchName}`, 9, true),
  text(LEFT, 540, fit(reportMeta(result,generatedOn),118), 6.5),
  text(690, 570, `Run #${result.runId}`, 7),
  text(690, 556, `Page ${page}/${totalPages}`, 7),
  { type: "rect", x: LEFT, y: TOP - HEADER_HEIGHT + 2, width: TABLE_WIDTH, height: HEADER_HEIGHT, lineWidth: 0.8 }
 ];
 let x = LEFT;
 for (const column of config.columns) {
  commands.push(text(x + 3, TOP - 13, fit(column.label,column.maxChars), 6.2, true));
  x += column.width;
 }
 return commands;
}
function operationalReportPages(result: ReportResult, context: ReportPdfContext): PdfLayoutCommand[][] {
 const config=configFor(result);
 const rows = result.rows;
 const generatedOn=new Date().toISOString().slice(0,10);
 const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
 const pages: PdfLayoutCommand[][] = [];
 for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
  const commands = pageHeader(config, context, result, pageIndex + 1, totalPages,generatedOn);
  const pageRows = rows.slice(pageIndex * ROWS_PER_PAGE, (pageIndex + 1) * ROWS_PER_PAGE);
  pageRows.forEach((row, rowIndex) => {
   const y = TOP - HEADER_HEIGHT - (rowIndex + 1) * ROW_HEIGHT + 5;
   commands.push({ type: "rect", x: LEFT, y: y - 5, width: TABLE_WIDTH, height: ROW_HEIGHT, lineWidth: 0.35 });
   let x = LEFT;
   for (const column of config.columns) {
    commands.push(text(x + 3, y + 2, fit(row[column.key], column.maxChars), 6.1));
    x += column.width;
   }
  });
  commands.push(text(LEFT, 20, `${result.rowCount} rows · Generated from live operational report data`, 6.5));
  pages.push(commands);
 }
 return pages;
}
export function createOperationalReportPdf(result: ReportResult, context: ReportPdfContext): Uint8Array {
 return createLayoutPdf({ pages: operationalReportPages(result, context), pageWidth: PAGE_WIDTH, pageHeight: PAGE_HEIGHT });
}
export async function createUnicodeOperationalReportPdf(result: ReportResult, context: ReportPdfContext): Promise<Uint8Array> {
 return createUnicodeLayoutPdf({ pages: operationalReportPages(result, context), pageWidth: PAGE_WIDTH, pageHeight: PAGE_HEIGHT });
}
export function supportsOperationalReportPdf(reportKey: string): boolean {
 return supported.has(reportKey);
}

import { createLayoutPdf, type PdfLayoutCommand } from "../documents/layout-pdf";
import { createUnicodeLayoutPdf } from "../documents/unicode-layout-pdf";
import type { ReportResult } from "./workspace";

type ReportPdfContext = {
  institutionName: string;
  branchName: string;
};

type ColumnConfig = { key: string; label: string; width: number; maxChars: number };

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const LEFT = 28;
const TOP = 548;
const ROW_HEIGHT = 19;
const HEADER_HEIGHT = 23;
const ROWS_PER_PAGE = 24;

const configs: Record<string, { title: string; columns: ColumnConfig[] }> = {
  admission_register: {
    title: "Admission Register",
    columns: [
      { key: "application_id", label: "Application", width: 68, maxChars: 12 },
      { key: "applicant_name", label: "Applicant", width: 138, maxChars: 24 },
      { key: "guardian_name", label: "Guardian", width: 125, maxChars: 22 },
      { key: "program", label: "Program", width: 115, maxChars: 20 },
      { key: "state", label: "State", width: 85, maxChars: 14 },
      { key: "submitted_at", label: "Submitted", width: 132, maxChars: 22 },
      { key: "converted_at", label: "Converted", width: 122, maxChars: 20 }
    ]
  },
  daily_attendance: {
    title: "Daily Student Attendance",
    columns: [
      { key: "student_number", label: "Student ID", width: 132, maxChars: 23 },
      { key: "name", label: "Student", width: 137, maxChars: 24 },
      { key: "class_group", label: "Class / group", width: 115, maxChars: 20 },
      { key: "status", label: "Status", width: 70, maxChars: 12 },
      { key: "source", label: "Source", width: 72, maxChars: 12 },
      { key: "marked_at", label: "Marked", width: 130, maxChars: 22 },
      { key: "note", label: "Note", width: 128, maxChars: 22 }
    ]
  }
};

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

function pageHeader(config: { title: string; columns: ColumnConfig[] }, context: ReportPdfContext, result: ReportResult, page: number, totalPages: number): PdfLayoutCommand[] {
  const commands: PdfLayoutCommand[] = [
    text(LEFT, 570, context.institutionName, 12, true),
    text(LEFT, 556, `${config.title} · ${context.branchName}`, 9, true),
    text(690, 570, `Run #${result.runId}`, 7),
    text(690, 556, `Page ${page}/${totalPages}`, 7),
    { type: "rect", x: LEFT, y: TOP - HEADER_HEIGHT + 2, width: 786, height: HEADER_HEIGHT, lineWidth: 0.8 }
  ];
  let x = LEFT;
  for (const column of config.columns) {
    commands.push(text(x + 4, TOP - 13, column.label, 6.5, true));
    x += column.width;
  }
  return commands;
}

function operationalReportPages(result: ReportResult, context: ReportPdfContext): PdfLayoutCommand[][] {
  const config = configs[result.reportKey];
  if (!config) throw new Error("PDF output is not supported for this report.");
  const rows = result.rows;
  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const pages: PdfLayoutCommand[][] = [];

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const commands = pageHeader(config, context, result, pageIndex + 1, totalPages);
    const pageRows = rows.slice(pageIndex * ROWS_PER_PAGE, (pageIndex + 1) * ROWS_PER_PAGE);
    pageRows.forEach((row, rowIndex) => {
      const y = TOP - HEADER_HEIGHT - (rowIndex + 1) * ROW_HEIGHT + 5;
      commands.push({ type: "rect", x: LEFT, y: y - 5, width: 786, height: ROW_HEIGHT, lineWidth: 0.35 });
      let x = LEFT;
      for (const column of config.columns) {
        commands.push(text(x + 4, y + 2, fit(row[column.key], column.maxChars), 6.4));
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
  return Object.prototype.hasOwnProperty.call(configs, reportKey);
}

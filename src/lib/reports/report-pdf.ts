import type { DocumentBlock, PdfRow } from "pdfnative";
import { createUnicodeDocumentPdf } from "../documents/unicode-pdf";
import { operationalReportKeys } from "./model";
import type { ReportResult } from "./workspace";

type ReportPdfContext = { institutionName: string; branchName: string };
const titles: Record<string, string> = {
  daily_attendance: "Attendance",
  student_strength: "Student strength",
  teacher_attendance: "Teacher attendance",
  quran_progress: "Qur’an / Hifz progress",
  program_progress: "Program progress",
  exam_performance: "Exam performance",
  absence_trend: "Absence trend",
  late_trend: "Late trend",
  new_admissions: "New admissions",
  group_program_comparison: "Group / program comparison"
};

function stringValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const titleize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, match => match.toUpperCase());

export async function createOperationalReportPdf(result: ReportResult, context: ReportPdfContext): Promise<Uint8Array> {
  if (!supportsOperationalReportPdf(result.reportKey)) throw new Error("PDF output is not supported for this report.");
  const displayColumns = result.columns.slice(0, 10);
  const rows: PdfRow[] = result.rows.map(row => ({
    cells: displayColumns.map(column => stringValue(row[column])),
    type: "neutral",
    pointed: false
  }));
  const blocks: DocumentBlock[] = [
    { type: "heading", text: context.institutionName, level: 2 },
    { type: "paragraph", text: `${titles[result.reportKey]} · ${context.branchName} · Run #${result.runId}` },
    {
      type: "table",
      headers: displayColumns.map(titleize),
      rows,
      wrap: "always",
      repeatHeader: true,
      autoFitColumns: true,
      minRowHeight: 14,
      cellPadding: 2,
      cellBorders: { all: true, width: 0.35 }
    }
  ];
  return createUnicodeDocumentPdf({
    title: titles[result.reportKey],
    blocks,
    footerText: `${result.rowCount} rows · Generated from live operational report data`,
    layout: {
      pageWidth: 842,
      pageHeight: 595,
      margins: { t: 28, r: 28, b: 30, l: 28 },
      fontSizes: { title: 13, th: 6.5, td: 6.2, ft: 6.5 }
    }
  });
}

export function supportsOperationalReportPdf(reportKey: string): boolean {
  return operationalReportKeys.includes(reportKey as typeof operationalReportKeys[number]);
}

import type { DocumentBlock, PdfRow } from "pdfnative";
import { createUnicodeDocumentPdf } from "../documents/unicode-pdf";

export type IdCardPdfStudent = {
  studentNumber: string;
  name: string;
  dateOfBirth: string | null;
  status: string;
  program: string;
  group: string;
  guardianName: string | null;
};

type IdCardPdfContext = {
  institutionName: string;
  branchName: string;
  academicYear: string;
};

const value = (input: string | null | undefined) => input?.trim() || "—";
const PER_PAGE = 4;

function front(student: IdCardPdfStudent, context: IdCardPdfContext): string {
  return [
    context.institutionName,
    student.name,
    `Student ID: ${student.studentNumber}`,
    `Program: ${student.program}`,
    `Class / group: ${student.group}`,
    `Campus: ${context.branchName}`,
    `Valid: ${context.academicYear}`
  ].join(" · ");
}

function back(student: IdCardPdfStudent, context: IdCardPdfContext): string {
  return [
    context.institutionName,
    "Student information",
    `Student ID: ${student.studentNumber}`,
    `Date of birth: ${value(student.dateOfBirth)}`,
    `Guardian: ${value(student.guardianName)}`,
    `Campus: ${context.branchName}`,
    `Status: ${student.status}`,
    "If found, return this card to the institution administration office."
  ].join(" · ");
}

export async function createStudentIdCardSheetPdf(students: IdCardPdfStudent[], context: IdCardPdfContext): Promise<Uint8Array> {
  if (!students.length) throw new Error("At least one student is required for an ID-card PDF.");
  const blocks: DocumentBlock[] = [];

  for (let offset = 0; offset < students.length; offset += PER_PAGE) {
    if (offset > 0) blocks.push({ type: "pageBreak" });
    const pageStudents = students.slice(offset, offset + PER_PAGE);
    blocks.push({
      type: "heading",
      text: `${context.institutionName} · Student ID cards · ${offset + 1}-${offset + pageStudents.length}`,
      level: 2
    });
    const rows: PdfRow[] = pageStudents.map(student => ({
      cells: [front(student, context), back(student, context)],
      type: "neutral",
      pointed: false
    }));
    blocks.push({
      type: "table",
      headers: ["ID card front", "ID card back"],
      rows,
      wrap: "always",
      repeatHeader: true,
      minRowHeight: 128,
      cellPadding: 8,
      cellBorders: { all: true, width: 0.8 },
      cellVAlign: "middle"
    });
  }

  return createUnicodeDocumentPdf({
    title: "Student ID card sheet",
    blocks,
    footerText: `${context.branchName} · ${context.academicYear}`,
    layout: {
      pageWidth: 595,
      pageHeight: 842,
      margins: { t: 28, r: 28, b: 28, l: 28 },
      fontSizes: { title: 11, th: 8, td: 8, ft: 7 }
    }
  });
}

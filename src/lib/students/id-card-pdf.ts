import { createLayoutPdf, type PdfLayoutCommand } from "../documents/layout-pdf";

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

const CARD_WIDTH = 242.65;
const CARD_HEIGHT = 153;
const LEFT_X = 40;
const RIGHT_X = 312.35;
const ROW_Y = [629, 461, 293, 125];
const PER_PAGE = ROW_Y.length;

function fit(value: string | null | undefined, max = 34): string {
  const text = value?.trim() || "-";
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 3))}...`;
}

function text(x: number, y: number, value: string, size = 8, bold = false): PdfLayoutCommand {
  return { type: "text", x, y, text: value, size, bold };
}

function frontCard(student: IdCardPdfStudent, context: IdCardPdfContext, x: number, y: number): PdfLayoutCommand[] {
  const top = y + CARD_HEIGHT;
  return [
    { type: "rect", x, y, width: CARD_WIDTH, height: CARD_HEIGHT, lineWidth: 0.9 },
    { type: "rect", x: x + 10, y: top - 33, width: 24, height: 24, lineWidth: 0.8 },
    text(x + 18, top - 26, "M", 12, true),
    text(x + 43, top - 18, fit(context.institutionName, 32), 9, true),
    text(x + 43, top - 30, "Institution identity card", 7),
    text(x + 12, top - 57, fit(student.name, 32), 12, true),
    text(x + 12, top - 73, `Student ID: ${fit(student.studentNumber, 28)}`, 8, true),
    text(x + 12, top - 89, `Program: ${fit(student.program, 30)}`, 8),
    text(x + 12, top - 104, `Class / group: ${fit(student.group, 27)}`, 8),
    text(x + 12, top - 126, fit(context.branchName, 30), 7),
    text(x + 126, top - 126, `Valid: ${fit(context.academicYear, 18)}`, 7, true)
  ];
}

function backCard(student: IdCardPdfStudent, context: IdCardPdfContext, x: number, y: number): PdfLayoutCommand[] {
  const top = y + CARD_HEIGHT;
  return [
    { type: "rect", x, y, width: CARD_WIDTH, height: CARD_HEIGHT, lineWidth: 0.9 },
    text(x + 12, top - 18, fit(context.institutionName, 32), 9, true),
    text(x + 12, top - 31, "Student information", 7),
    text(x + 12, top - 54, `Student ID: ${fit(student.studentNumber, 28)}`, 8, true),
    text(x + 12, top - 70, `Date of birth: ${fit(student.dateOfBirth, 20)}`, 8),
    text(x + 12, top - 86, `Guardian: ${fit(student.guardianName, 30)}`, 8),
    text(x + 12, top - 102, `Campus: ${fit(context.branchName, 30)}`, 8),
    text(x + 12, top - 119, `Status: ${fit(student.status, 20)}`, 7),
    text(x + 12, top - 137, "If found, return this card to the institution administration office.", 6.5)
  ];
}

export function createStudentIdCardSheetPdf(students: IdCardPdfStudent[], context: IdCardPdfContext): Uint8Array {
  if (!students.length) throw new Error("At least one student is required for an ID-card PDF.");
  const pages: PdfLayoutCommand[][] = [];

  for (let offset = 0; offset < students.length; offset += PER_PAGE) {
    const pageStudents = students.slice(offset, offset + PER_PAGE);
    const commands: PdfLayoutCommand[] = [
      text(40, 815, `${fit(context.institutionName, 48)} - Student ID card sheet`, 11, true),
      text(40, 801, `${fit(context.branchName, 36)} | ${fit(context.academicYear, 24)} | Cards ${offset + 1}-${offset + pageStudents.length}`, 7)
    ];
    pageStudents.forEach((student, index) => {
      const y = ROW_Y[index];
      commands.push(...frontCard(student, context, LEFT_X, y));
      commands.push(...backCard(student, context, RIGHT_X, y));
    });
    pages.push(commands);
  }

  return createLayoutPdf({ pages });
}

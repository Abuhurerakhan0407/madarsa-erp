import { createLayoutPdf, type PdfJpegImage, type PdfLayoutCommand } from "../documents/layout-pdf";
import { createUnicodeLayoutPdf } from "../documents/unicode-layout-pdf";

export type IdCardPdfStudent = {
  studentNumber: string;
  name: string;
  nativeName?: string | null;
  dateOfBirth: string | null;
  status: string;
  program: string;
  group: string;
  guardianName: string | null;
  photo?: PdfJpegImage | null;
};

type IdCardPdfContext = {
  institutionName: string;
  branchName: string;
  academicYear: string;
  locale?: "en" | "ur";
};

const copy = {
  en: { identity: "Student identity card", id: "Student ID", program: "Program", group: "Class / group", valid: "Valid", info: "Student information", dob: "Date of birth", guardian: "Guardian", campus: "Campus", status: "Status", return: "If found, return this card to the institution administration office.", sheet: "Student ID card sheet", cards: "Cards" },
  ur: { identity: "طالب علم شناختی کارڈ", id: "طالب علم ID", program: "پروگرام", group: "کلاس / گروپ", valid: "تعلیمی سیشن", info: "طالب علم معلومات", dob: "تاریخ پیدائش", guardian: "سرپرست", campus: "کیمپس", status: "حیثیت", return: "اگر یہ کارڈ ملے تو ادارہ انتظامیہ کو واپس کریں۔", sheet: "طالب علم ID کارڈ شیٹ", cards: "کارڈز" }
} as const;

const CARD_WIDTH = 242.65;
const CARD_HEIGHT = 153;
const LEFT_X = 40;
const RIGHT_X = 312.35;
const ROW_Y = [629, 461, 293, 125];
const PER_PAGE = ROW_Y.length;

function fit(value: string | null | undefined, max = 34): string {
  const normalized = value?.trim() || "-";
  return normalized.length <= max ? normalized : `${normalized.slice(0, Math.max(1, max - 3))}...`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "ST";
  const first = parts[0]?.[0] ?? "S";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : parts[0]?.[1] ?? "";
  return `${first}${last}`.toUpperCase();
}

function text(x: number, y: number, value: string, size = 8, bold = false): PdfLayoutCommand {
  return { type: "text", x, y, text: value, size, bold };
}

function frontCard(student: IdCardPdfStudent, context: IdCardPdfContext, x: number, y: number): PdfLayoutCommand[] {
  const t = copy[context.locale ?? "en"];
  const top = y + CARD_HEIGHT;
  const portraitX = x + 169;
  const portraitY = y + 42;
  const portraitWidth = 58;
  const portraitHeight = 76;
  const portrait: PdfLayoutCommand[] = student.photo
    ? [
        { type: "rect", x: portraitX - 1, y: portraitY - 1, width: portraitWidth + 2, height: portraitHeight + 2, lineWidth: 0.7 },
        { type: "image", x: portraitX, y: portraitY, width: portraitWidth, height: portraitHeight, image: student.photo }
      ]
    : [
        { type: "rect", x: portraitX - 1, y: portraitY - 1, width: portraitWidth + 2, height: portraitHeight + 2, lineWidth: 0.7 },
        text(portraitX + 18, portraitY + 33, initials(student.name), 13, true)
      ];

  return [
    { type: "rect", x, y, width: CARD_WIDTH, height: CARD_HEIGHT, lineWidth: 0.9 },
    text(x + 12, top - 18, fit(context.institutionName, 38), 9, true),
    text(x + 12, top - 30, t.identity, 7),
    text(x + 12, top - 50, fit(student.name, 22), 10.5, true),
    ...(student.nativeName ? [text(x + 12, top - 62, fit(student.nativeName, 23), 7.2)] : []),
    text(x + 12, top - 76, `${t.id}: ${fit(student.studentNumber, 16)}`, 7.6, true),
    text(x + 12, top - 91, `${t.program}: ${fit(student.program, 18)}`, 7.4),
    text(x + 12, top - 105, `${t.group}: ${fit(student.group, 14)}`, 7.4),
    text(x + 12, top - 121, fit(context.branchName, 21), 7),
    text(x + 12, top - 136, `${t.valid}: ${fit(context.academicYear, 18)}`, 6.8, true),
    ...portrait
  ];
}

function backCard(student: IdCardPdfStudent, context: IdCardPdfContext, x: number, y: number): PdfLayoutCommand[] {
  const t = copy[context.locale ?? "en"];
  const top = y + CARD_HEIGHT;
  return [
    { type: "rect", x, y, width: CARD_WIDTH, height: CARD_HEIGHT, lineWidth: 0.9 },
    text(x + 12, top - 18, fit(context.institutionName, 32), 9, true),
    text(x + 12, top - 31, t.info, 7),
    text(x + 12, top - 54, `${t.id}: ${fit(student.studentNumber, 28)}`, 8, true),
    text(x + 12, top - 70, `${t.dob}: ${fit(student.dateOfBirth, 20)}`, 8),
    text(x + 12, top - 86, `${t.guardian}: ${fit(student.guardianName, 30)}`, 8),
    text(x + 12, top - 102, `${t.campus}: ${fit(context.branchName, 30)}`, 8),
    text(x + 12, top - 119, `${t.status}: ${fit(student.status, 20)}`, 7),
    text(x + 12, top - 137, t.return, 6.2)
  ];
}

function idCardPages(students: IdCardPdfStudent[], context: IdCardPdfContext): PdfLayoutCommand[][] {
  if (!students.length) throw new Error("At least one student is required for an ID-card PDF.");
  const t = copy[context.locale ?? "en"];
  const pages: PdfLayoutCommand[][] = [];

  for (let offset = 0; offset < students.length; offset += PER_PAGE) {
    const pageStudents = students.slice(offset, offset + PER_PAGE);
    const commands: PdfLayoutCommand[] = [
      text(40, 815, `${fit(context.institutionName, 48)} - ${t.sheet}`, 11, true),
      text(40, 801, `${fit(context.branchName, 36)} | ${fit(context.academicYear, 24)} | ${t.cards} ${offset + 1}-${offset + pageStudents.length}`, 7)
    ];
    pageStudents.forEach((student, index) => {
      const y = ROW_Y[index];
      commands.push(...frontCard(student, context, LEFT_X, y));
      commands.push(...backCard(student, context, RIGHT_X, y));
    });
    pages.push(commands);
  }
  return pages;
}

export function createStudentIdCardSheetPdf(students: IdCardPdfStudent[], context: IdCardPdfContext): Uint8Array {
  return createLayoutPdf({ pages: idCardPages(students, context) });
}

export async function createUnicodeStudentIdCardSheetPdf(students: IdCardPdfStudent[], context: IdCardPdfContext): Promise<Uint8Array> {
  return createUnicodeLayoutPdf({ pages: idCardPages(students, context) });
}

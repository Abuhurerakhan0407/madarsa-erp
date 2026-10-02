export type PdfTextLine = {
  text: string;
  size?: number;
  bold?: boolean;
  gapAfter?: number;
  pageBreakBefore?: boolean;
};

type PdfOptions = {
  title: string;
  lines: PdfTextLine[];
};

const encoder = new TextEncoder();

function ascii(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function chunks(value: string, width = 84): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word.length <= width ? word : word.slice(0, width);
  }
  if (current) lines.push(current);
  return lines;
}

function pageContent(lines: PdfTextLine[]): string {
  let y = 795;
  const output: string[] = [];
  for (const line of lines) {
    const size = Math.min(Math.max(line.size ?? 10, 7), 24);
    const font = line.bold ? "F2" : "F1";
    for (const part of chunks(line.text, size >= 16 ? 60 : 84)) {
      output.push(`BT /${font} ${size} Tf 48 ${y} Td (${ascii(part)}) Tj ET`);
      y -= Math.max(size + 5, 14);
    }
    y -= line.gapAfter ?? 0;
  }
  return output.join("\n");
}

function splitPages(lines: PdfTextLine[]): PdfTextLine[][] {
  const pages: PdfTextLine[][] = [];
  let page: PdfTextLine[] = [];
  let used = 0;
  for (const line of lines) {
    if (line.pageBreakBefore && page.length) { pages.push(page); page = []; used = 0; }
    const size = Math.min(Math.max(line.size ?? 10, 7), 24);
    const wrapped = chunks(line.text, size >= 16 ? 60 : 84).length;
    const height = wrapped * Math.max(size + 5, 14) + (line.gapAfter ?? 0);
    if (page.length && used + height > 715) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(line);
    used += height;
  }
  if (page.length) pages.push(page);
  return pages.length ? pages : [[{ text: "", size: 10 }]];
}

export function createSimplePdf(options: PdfOptions): Uint8Array {
  const pages = splitPages([{ text: options.title, size: 20, bold: true, gapAfter: 12 }, ...options.lines]);
  const objects = new Map<number, string>();
  const regularFont = 3;
  const boldFont = 4;
  const firstPageObject = 5;
  const pageRefs: number[] = [];

  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(regularFont, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.set(boldFont, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  pages.forEach((pageLines, index) => {
    const pageObject = firstPageObject + index * 2;
    const contentObject = pageObject + 1;
    pageRefs.push(pageObject);
    const stream = pageContent(pageLines);
    objects.set(pageObject, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${regularFont} 0 R /F2 ${boldFont} 0 R >> >> /Contents ${contentObject} 0 R >>`);
    objects.set(contentObject, `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`);
  });
  objects.set(2, `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`);

  const maxObject = Math.max(...objects.keys());
  let body = "%PDF-1.4\n%MADRASA-ERP\n";
  const offsets: number[] = [0];
  for (let objectNumber = 1; objectNumber <= maxObject; objectNumber += 1) {
    const value = objects.get(objectNumber);
    if (!value) throw new Error(`Missing PDF object ${objectNumber}.`);
    offsets[objectNumber] = encoder.encode(body).length;
    body += `${objectNumber} 0 obj\n${value}\nendobj\n`;
  }
  const xrefOffset = encoder.encode(body).length;
  body += `xref\n0 ${maxObject + 1}\n0000000000 65535 f \n`;
  for (let objectNumber = 1; objectNumber <= maxObject; objectNumber += 1) {
    body += `${String(offsets[objectNumber]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${maxObject + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return encoder.encode(body);
}

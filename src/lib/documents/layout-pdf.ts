export type PdfLayoutCommand =
  | { type: "text"; x: number; y: number; text: string; size?: number; bold?: boolean }
  | { type: "rect"; x: number; y: number; width: number; height: number; lineWidth?: number };

type PdfLayoutOptions = {
  pages: PdfLayoutCommand[][];
  pageWidth?: number;
  pageHeight?: number;
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

function number(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function pageContent(commands: PdfLayoutCommand[]): string {
  return commands.map((command) => {
    if (command.type === "rect") {
      return `q ${number(command.lineWidth ?? 0.8)} w ${number(command.x)} ${number(command.y)} ${number(command.width)} ${number(command.height)} re S Q`;
    }
    const size = Math.min(Math.max(command.size ?? 9, 6), 24);
    const font = command.bold ? "F2" : "F1";
    return `BT /${font} ${number(size)} Tf ${number(command.x)} ${number(command.y)} Td (${ascii(command.text)}) Tj ET`;
  }).join("\n");
}

export function createLayoutPdf(options: PdfLayoutOptions): Uint8Array {
  const pages = options.pages.length ? options.pages : [[]];
  const pageWidth = options.pageWidth ?? 595;
  const pageHeight = options.pageHeight ?? 842;
  if (pageWidth <= 0 || pageHeight <= 0) throw new Error("PDF page dimensions must be positive.");
  const objects = new Map<number, string>();
  const regularFont = 3;
  const boldFont = 4;
  const firstPageObject = 5;
  const pageRefs: number[] = [];

  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(regularFont, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.set(boldFont, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  pages.forEach((commands, index) => {
    const pageObject = firstPageObject + index * 2;
    const contentObject = pageObject + 1;
    pageRefs.push(pageObject);
    const stream = pageContent(commands);
    objects.set(pageObject, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${number(pageWidth)} ${number(pageHeight)}] /Resources << /Font << /F1 ${regularFont} 0 R /F2 ${boldFont} 0 R >> >> /Contents ${contentObject} 0 R >>`);
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

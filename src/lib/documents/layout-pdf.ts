export type PdfJpegImage = {
  data: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
};

export type PdfLayoutCommand =
  | { type: "text"; x: number; y: number; text: string; size?: number; bold?: boolean }
  | { type: "rect"; x: number; y: number; width: number; height: number; lineWidth?: number }
  | { type: "image"; x: number; y: number; width: number; height: number; image: PdfJpegImage };

type PdfLayoutOptions = {
  pages: PdfLayoutCommand[][];
  pageWidth?: number;
  pageHeight?: number;
};

type ImageCommand = Extract<PdfLayoutCommand, { type: "image" }>;
type PageImageRef = { command: ImageCommand; name: string; objectRef: number };

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

function ascii85(bytes: Uint8Array): string {
  let output = "";
  for (let offset = 0; offset < bytes.length; offset += 4) {
    const remaining = Math.min(4, bytes.length - offset);
    let value = 0;
    for (let index = 0; index < 4; index += 1) {
      value = value * 256 + (index < remaining ? bytes[offset + index] : 0);
    }
    if (remaining === 4 && value === 0) {
      output += "z";
      continue;
    }
    const encoded = new Array<string>(5);
    for (let index = 4; index >= 0; index -= 1) {
      encoded[index] = String.fromCharCode((value % 85) + 33);
      value = Math.floor(value / 85);
    }
    output += encoded.slice(0, remaining + 1).join("");
  }
  return `${output}~>`;
}

function pageContent(commands: PdfLayoutCommand[], imageRefs: PageImageRef[]): string {
  let imageIndex = 0;
  return commands.map((command) => {
    if (command.type === "rect") {
      return `q ${number(command.lineWidth ?? 0.8)} w ${number(command.x)} ${number(command.y)} ${number(command.width)} ${number(command.height)} re S Q`;
    }
    if (command.type === "image") {
      const imageRef = imageRefs[imageIndex];
      imageIndex += 1;
      if (!imageRef) throw new Error("Missing PDF image reference.");
      return `q ${number(command.width)} 0 0 ${number(command.height)} ${number(command.x)} ${number(command.y)} cm /${imageRef.name} Do Q`;
    }
    const size = Math.min(Math.max(command.size ?? 9, 6), 24);
    const font = command.bold ? "F2" : "F1";
    return `BT /${font} ${number(size)} Tf ${number(command.x)} ${number(command.y)} Td (${ascii(command.text)}) Tj ET`;
  }).join("\n");
}

function imageObject(image: PdfJpegImage): string {
  if (!Number.isInteger(image.pixelWidth) || image.pixelWidth <= 0 || !Number.isInteger(image.pixelHeight) || image.pixelHeight <= 0) {
    throw new Error("PDF image dimensions must be positive integers.");
  }
  if (!image.data.length) throw new Error("PDF image data is required.");
  const stream = ascii85(image.data);
  return `<< /Type /XObject /Subtype /Image /Width ${image.pixelWidth} /Height ${image.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCII85Decode /DCTDecode] /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`;
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
  const firstImageObject = firstPageObject + pages.length * 2;
  const pageRefs: number[] = [];
  const imageRefsByPage: PageImageRef[][] = [];
  let nextImageObject = firstImageObject;

  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(regularFont, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.set(boldFont, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  pages.forEach((commands) => {
    const imageRefs: PageImageRef[] = [];
    for (const command of commands) {
      if (command.type !== "image") continue;
      imageRefs.push({ command, name: `Im${imageRefs.length + 1}`, objectRef: nextImageObject });
      nextImageObject += 1;
    }
    imageRefsByPage.push(imageRefs);
  });

  pages.forEach((commands, index) => {
    const pageObject = firstPageObject + index * 2;
    const contentObject = pageObject + 1;
    const imageRefs = imageRefsByPage[index];
    pageRefs.push(pageObject);
    const stream = pageContent(commands, imageRefs);
    const xObjects = imageRefs.length
      ? ` /XObject << ${imageRefs.map((image) => `/${image.name} ${image.objectRef} 0 R`).join(" ")} >>`
      : "";
    objects.set(pageObject, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${number(pageWidth)} ${number(pageHeight)}] /Resources << /Font << /F1 ${regularFont} 0 R /F2 ${boldFont} 0 R >>${xObjects} >> /Contents ${contentObject} 0 R >>`);
    objects.set(contentObject, `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`);
  });

  for (const imageRefs of imageRefsByPage) {
    for (const imageRef of imageRefs) objects.set(imageRef.objectRef, imageObject(imageRef.command.image));
  }

  objects.set(2, `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`);

  const maxObject = Math.max(...objects.keys());
  let body = "%PDF-1.4\n%ILMGAAH\n";
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

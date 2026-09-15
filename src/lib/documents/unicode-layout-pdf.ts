import { join } from "node:path";
import sharp from "sharp";
import { createLayoutPdf, type PdfJpegImage, type PdfLayoutCommand } from "./layout-pdf";

type UnicodePdfLayoutOptions = {
  pages: PdfLayoutCommand[][];
  pageWidth?: number;
  pageHeight?: number;
};

type TextCommand = Extract<PdfLayoutCommand, { type: "text" }>;

const ARABIC_SCRIPT = /[\u0600-\u06ff\u0750-\u077f\u0870-\u089f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u;
const RASTER_DPI = 144;
const POINTS_PER_INCH = 72;

export function needsComplexPdfText(text: string): boolean {
  return ARABIC_SCRIPT.test(text);
}

function pangoEscape(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function arabicFontPath(bold: boolean): string {
  return join(
    process.cwd(),
    "node_modules",
    "@embedpdf",
    "fonts-arabic",
    "fonts",
    bold ? "NotoNaskhArabic-Bold.ttf" : "NotoNaskhArabic-Regular.ttf"
  );
}

export async function rasterizeComplexPdfText(command: TextCommand): Promise<PdfLayoutCommand> {
  if (!needsComplexPdfText(command.text)) return command;

  const size = Math.min(Math.max(command.size ?? 9, 6), 24);
  const font = command.bold ? `Noto Naskh Arabic Bold ${size}` : `Noto Naskh Arabic ${size}`;
  const { data, info } = await sharp({
    text: {
      text: pangoEscape(command.text),
      font,
      fontfile: arabicFontPath(Boolean(command.bold)),
      dpi: RASTER_DPI,
      rgba: true,
      align: "right"
    }
  })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer({ resolveWithObject: true });

  if (!info.width || !info.height) throw new Error("Complex PDF text raster dimensions are unavailable.");

  const scale = POINTS_PER_INCH / RASTER_DPI;
  const image: PdfJpegImage = {
    data: new Uint8Array(data),
    pixelWidth: info.width,
    pixelHeight: info.height
  };
  const height = info.height * scale;

  return {
    type: "image",
    x: command.x,
    y: command.y - size * 0.25,
    width: info.width * scale,
    height,
    image
  };
}

export async function createUnicodeLayoutPdf(options: UnicodePdfLayoutOptions): Promise<Uint8Array> {
  const pages = await Promise.all(
    options.pages.map(async (commands) => Promise.all(
      commands.map(async (command) => command.type === "text" ? rasterizeComplexPdfText(command) : command)
    ))
  );

  return createLayoutPdf({ ...options, pages });
}

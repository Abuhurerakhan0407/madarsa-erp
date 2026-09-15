import { join } from "node:path";
import sharp from "sharp";
import { createLayoutPdf, type PdfJpegImage, type PdfLayoutCommand } from "./layout-pdf";

type UnicodePdfLayoutOptions = {
  pages: PdfLayoutCommand[][];
  pageWidth?: number;
  pageHeight?: number;
};

type TextCommand = Extract<PdfLayoutCommand, { type: "text" }>;
type TextJob = { pageIndex: number; commandIndex: number; command: TextCommand };

const ARABIC_SCRIPT = /[\u0600-\u06ff\u0750-\u077f\u0870-\u089f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u;
const RASTER_DPI = 144;
const POINTS_PER_INCH = 72;
const RASTER_WORKERS = 4;

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

function renderKey(command: TextCommand): string {
  return `${command.bold ? "b" : "r"}|${command.size ?? 9}|${command.text}`;
}

export async function rasterizeComplexPdfText(command: TextCommand): Promise<PdfLayoutCommand> {
  if (!needsComplexPdfText(command.text)) return command;

  const size = Math.min(Math.max(command.size ?? 9, 6), 24);
  const bold = Boolean(command.bold);
  const font = bold ? `Noto Naskh Arabic Bold ${size}` : `Noto Naskh Arabic ${size}`;
  const { data, info } = await sharp({
    text: {
      text: pangoEscape(command.text),
      font,
      fontfile: arabicFontPath(bold),
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

  return {
    type: "image",
    x: command.x,
    y: command.y - size * 0.25,
    width: info.width * scale,
    height: info.height * scale,
    image
  };
}

export async function createUnicodeLayoutPdf(options: UnicodePdfLayoutOptions): Promise<Uint8Array> {
  const pages = options.pages.map((commands) => [...commands]);
  const jobs: TextJob[] = [];
  pages.forEach((commands, pageIndex) => {
    commands.forEach((command, commandIndex) => {
      if (command.type === "text" && needsComplexPdfText(command.text)) jobs.push({ pageIndex, commandIndex, command });
    });
  });

  const cache = new Map<string, Promise<PdfLayoutCommand>>();
  let cursor = 0;
  async function worker() {
    while (true) {
      const jobIndex = cursor;
      cursor += 1;
      if (jobIndex >= jobs.length) return;
      const job = jobs[jobIndex];
      const key = renderKey(job.command);
      let rendered = cache.get(key);
      if (!rendered) {
        rendered = rasterizeComplexPdfText(job.command);
        cache.set(key, rendered);
      }
      pages[job.pageIndex][job.commandIndex] = await rendered;
    }
  }

  await Promise.all(Array.from({ length: Math.min(RASTER_WORKERS, Math.max(1, jobs.length)) }, () => worker()));
  return createLayoutPdf({ ...options, pages });
}

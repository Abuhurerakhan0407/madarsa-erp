import {
  buildDocumentPDFBytes,
  loadFontData,
  registerFont,
  type DocumentBlock,
  type FontEntry,
  type FontLoader,
  type PdfLayoutOptions
} from "pdfnative";

let registered = false;

function registerDocumentFonts(): void {
  if (registered) return;
  registerFont("latin", (() => import("pdfnative/fonts/noto-sans-data.js")) as unknown as FontLoader);
  registerFont("ar", (() => import("pdfnative/fonts/noto-arabic-data.js")) as unknown as FontLoader);
  registered = true;
}

async function loadDocumentFonts(): Promise<FontEntry[]> {
  registerDocumentFonts();
  const [latin, arabic] = await Promise.all([loadFontData("latin"), loadFontData("ar")]);
  if (!latin || !arabic) throw new Error("Unicode PDF fonts failed to load.");
  return [
    { fontData: latin, fontRef: "/F3", lang: "latin" },
    { fontData: arabic, fontRef: "/F4", lang: "ar" }
  ];
}

export async function createUnicodeDocumentPdf(options: {
  title: string;
  blocks: readonly DocumentBlock[];
  footerText?: string;
  layout?: Partial<PdfLayoutOptions>;
}): Promise<Uint8Array> {
  const fontEntries = await loadDocumentFonts();
  return buildDocumentPDFBytes(
    {
      title: options.title,
      blocks: options.blocks,
      footerText: options.footerText,
      fontEntries
    },
    options.layout
  );
}

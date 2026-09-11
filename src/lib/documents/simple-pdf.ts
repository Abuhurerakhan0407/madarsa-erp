import type { DocumentBlock } from "pdfnative";
import { createUnicodeDocumentPdf } from "./unicode-pdf";

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

function headingLevel(size: number): 1 | 2 | 3 {
  if (size >= 18) return 1;
  if (size >= 13) return 2;
  return 3;
}

function lineBlocks(line: PdfTextLine): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  if (line.pageBreakBefore) blocks.push({ type: "pageBreak" });

  const size = Math.min(Math.max(line.size ?? 10, 7), 24);
  if (!line.text.trim()) {
    blocks.push({ type: "spacer", height: Math.max(6, line.gapAfter ?? 6) });
    return blocks;
  }

  if (line.bold) {
    blocks.push({ type: "heading", text: line.text, level: headingLevel(size) });
  } else {
    blocks.push({ type: "paragraph", text: line.text, fontSize: size, lineHeight: Math.max(size + 4, 12) });
  }

  if ((line.gapAfter ?? 0) > 0) blocks.push({ type: "spacer", height: line.gapAfter ?? 0 });
  return blocks;
}

export async function createSimplePdf(options: PdfOptions): Promise<Uint8Array> {
  const blocks = options.lines.flatMap(lineBlocks);
  return createUnicodeDocumentPdf({ title: options.title, blocks });
}

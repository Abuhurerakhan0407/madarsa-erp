import { describe, expect, it } from "vitest";
import { extractText } from "pdfnative";
import { createSimplePdf } from "./simple-pdf";

const extracted = (bytes: Uint8Array) => extractText(bytes).map(page => page.text).join("\n");
const hasArabicGlyphs = (text: string) => /[\u0600-\u06ff\ufb50-\ufdff\ufe70-\ufeff]/u.test(text);

describe("simple PDF renderer", () => {
  it("preserves Latin, shaped Urdu/Arabic glyphs and long unbroken text", async () => {
    const longToken = "STUDENT-" + "A".repeat(120) + "-END";
    const bytes = await createSimplePdf({
      title: "Report Card",
      lines: [
        { text: "Student: Ayaan (Year 1) \\ verified", bold: true },
        { text: "طالب علم: محمد عبداللہ" },
        { text: longToken }
      ]
    });
    const text = extracted(bytes);
    expect(new TextDecoder().decode(bytes).startsWith("%PDF-")).toBe(true);
    expect(text).toContain("Ayaan (Year 1) \\ verified");
    expect(hasArabicGlyphs(text)).toBe(true);
    expect(text).not.toContain("????");
    expect(text.replace(/\s+/g,"")).toContain(longToken);
  });

  it("paginates long documents without dropping the final line", async () => {
    const bytes = await createSimplePdf({
      title: "Long report",
      lines: Array.from({ length: 90 }, (_, index) => ({ text: `Line ${index + 1}: governed report content` }))
    });
    const pages = extractText(bytes);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.map(page => page.text).join("\n")).toContain("Line 90: governed report content");
  });
});

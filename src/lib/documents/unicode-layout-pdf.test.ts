import { describe, expect, it } from "vitest";
import { createUnicodeLayoutPdf, needsComplexPdfText, rasterizeComplexPdfText } from "./unicode-layout-pdf";

describe("Unicode PDF text rasterization", () => {
  it("detects Urdu/Arabic script without routing ordinary English through Sharp", () => {
    expect(needsComplexPdfText("طالب علم: محمد عبداللہ خان")).toBe(true);
    expect(needsComplexPdfText("Student: Muhammad Abdullah Khan")).toBe(false);
  });

  it("renders bold Urdu through the bundled Noto Naskh TTF as a JPEG XObject", async () => {
    const command = { type: "text" as const, x: 72, y: 700, text: "طالب علم: محمد عبداللہ خان — جماعت ۵", size: 12, bold: true };
    const rendered = await rasterizeComplexPdfText(command);
    expect(rendered.type).toBe("image");
    if (rendered.type !== "image") throw new Error("Expected rasterized Urdu PDF text.");
    expect(rendered.image.pixelWidth).toBeGreaterThan(10);
    expect(rendered.image.pixelHeight).toBeGreaterThan(5);
    expect(rendered.image.data[0]).toBe(0xff);
    expect(rendered.image.data[1]).toBe(0xd8);
    expect(rendered.width).toBeGreaterThan(10);
    expect(rendered.height).toBeGreaterThan(5);
  });

  it("keeps Latin text native while embedding shaped Urdu in the same PDF", async () => {
    const pdf = await createUnicodeLayoutPdf({
      pages: [[
        { type: "text", x: 72, y: 740, text: "Ilmgaah Urdu PDF proof", size: 12, bold: true },
        { type: "text", x: 72, y: 710, text: "طالب علم: محمد عبداللہ خان", size: 12 }
      ]]
    });
    const raw = new TextDecoder().decode(pdf);
    expect(raw).toContain("%ILMGAAH");
    expect(raw).toContain("Ilmgaah Urdu PDF proof");
    expect(raw).toContain("/Subtype /Image");
    expect(raw).not.toContain("????");
  });
});

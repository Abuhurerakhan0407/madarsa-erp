import { describe, expect, it } from "vitest";
import { createSimplePdf } from "./simple-pdf";

describe("simple PDF renderer", () => {
  it("creates a valid PDF envelope with escaped text", () => {
    const bytes = createSimplePdf({
      title: "Report Card",
      lines: [{ text: "Student: Ayaan (Year 1) \\ verified", bold: true }]
    });
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("xref");
    expect(text).toContain("trailer");
    expect(text).toContain("%%EOF");
    expect(text).toContain("Ayaan \\(Year 1\\) \\\\ verified");
  });

  it("paginates long documents", () => {
    const bytes = createSimplePdf({
      title: "Long report",
      lines: Array.from({ length: 90 }, (_, index) => ({ text: `Line ${index + 1}: governed report content` }))
    });
    const text = new TextDecoder().decode(bytes);
    const match = text.match(/\/Type \/Pages \/Kids \[[^\]]+\] \/Count (\d+)/);
    expect(Number(match?.[1] ?? 0)).toBeGreaterThan(1);
  });
});

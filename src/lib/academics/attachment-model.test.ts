import { describe, expect, it } from "vitest";
import { detectAcademicAttachmentType, isAcademicAttachmentKind } from "./attachment-model";

describe("academic attachment validation", () => {
  it("detects permitted file signatures", () => {
    expect(detectAcademicAttachmentType(Uint8Array.from([37,80,68,70,45,49]))).toBe("application/pdf");
    expect(detectAcademicAttachmentType(Uint8Array.from([255,216,255,224]))).toBe("image/jpeg");
    expect(detectAcademicAttachmentType(Uint8Array.from([137,80,78,71,13,10,26,10]))).toBe("image/png");
    expect(detectAcademicAttachmentType(Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80]))).toBe("image/webp");
  });

  it("rejects extension-only or arbitrary bytes", () => {
    expect(detectAcademicAttachmentType(new TextEncoder().encode("homework.pdf"))).toBeNull();
    expect(detectAcademicAttachmentType(Uint8Array.from([0,1,2,3,4,5]))).toBeNull();
  });

  it("limits upload purposes to homework and calendar", () => {
    expect(isAcademicAttachmentKind("homework")).toBe(true);
    expect(isAcademicAttachmentKind("calendar")).toBe(true);
    expect(isAcademicAttachmentKind("student-photo")).toBe(false);
  });
});

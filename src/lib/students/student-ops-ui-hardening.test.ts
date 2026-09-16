import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const admission = read("../../components/student-create-form-v3.tsx");
const register = read("../../app/[locale]/students/page.tsx");
const registerCss = read("../../app/[locale]/students/students.css");
const singleId = read("../../app/[locale]/students/[personId]/id-card/page.tsx");
const batchId = read("../../app/[locale]/students/id-cards/print/page.tsx");
const batchPdf = read("../../app/api/students/id-cards/pdf/route.ts");
const documentsPage = read("../../app/[locale]/documents/page.tsx");
const documentsPdf = read("../../app/api/documents/pdf/route.ts");
const photoUpload = read("../../app/api/students/photo/[personId]/upload/route.ts");

describe("student operations UI hardening", () => {
  it("locks admission creation and photo attachment against rapid duplicate submission", () => {
    expect(admission).toContain("submissionLock.current");
    expect(admission).toContain("photoUploadLock.current");
  });

  it("renders the student register as a scoped mobile card table with real-ID links", () => {
    expect(register).toContain('className="student-register-table"');
    expect(register).toContain("data-label={text.name}");
    expect(register).toContain("data-label={text.joined}");
    expect(register).toContain('students/${row.personId}');
    expect(registerCss).toContain(".student-register-section .workspace-table-frame");
  });

  it("uses the selected academic session on single and batch ID cards", () => {
    expect(singleId).not.toContain("2026–27");
    expect(singleId).toContain("student.academicSession");
    expect(batchId).not.toContain("2026–27");
    expect(batchId).toContain("academicSession");
    expect(batchPdf).not.toContain("Current academic year");
    expect(batchPdf).toContain("!sessionId || !groupId");
    expect(singleId).not.toContain('className={styles.brandMark}>M</div>');
    expect(batchId).not.toContain('className={styles.brandMark}>M</div>');
    expect(batchPdf).not.toContain('"Main Branch"');
  });

  it("routes recent governed documents by their actual template type", () => {
    expect(documentsPage).toContain("type==='student_id_card'");
    expect(documentsPage).toContain("type==='student_profile'");
    expect(documentsPage).toContain("type==='status_certificate'");
    expect(documentsPage).not.toContain('href={`/${locale}/exams/report-card/${item.personId}`}');
    expect(documentsPdf).not.toContain("Current academic year");
    expect(documentsPdf).not.toContain("Multiple academic years");
    expect(documentsPdf).toContain("academicYears.length!==1");
    expect(documentsPdf).toContain("{label:'Native name',value:student.nativeName}");
  });

  it("removes the previous tenant-scoped private photo object after a successful replacement", () => {
    expect(photoUpload).toContain("previous_storage_path");
    expect(photoUpload).toContain("expectedPrefix");
    expect(photoUpload).toContain("await bucket.remove([previousStoragePath])");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const admission = read("../../components/student-create-form-v3.tsx");
const register = read("../../app/[locale]/students/page.tsx");
const registerCss = read("../../app/[locale]/students/students.css");
const singleId = read("../../app/[locale]/students/[personId]/id-card/page.tsx");
const singleIdLayout = read("../../app/[locale]/students/[personId]/id-card/layout.tsx");
const batchIdList = read("../../app/[locale]/students/id-cards/page.tsx");
const batchIdLayout = read("../../app/[locale]/students/id-cards/layout.tsx");
const batchId = read("../../app/[locale]/students/id-cards/print/page.tsx");
const batchPdf = read("../../app/api/students/id-cards/pdf/route.ts");
const documentsLayout = read("../../app/[locale]/documents/layout.tsx");
const documentsPage = read("../../app/[locale]/documents/page.tsx");
const documentsPdf = read("../../app/api/documents/pdf/route.ts");
const studentDocuments = read("../documents/student-files.ts");
const studentDocumentsPage = read("../../app/[locale]/documents/student-documents/[personId]/page.tsx");
const studentDocumentDownload = read("../../app/api/students/[personId]/documents/[documentId]/download/route.ts");
const photoUpload = read("../../app/api/students/photo/[personId]/upload/route.ts");
const studentDetailPage = read("../../app/[locale]/students/[personId]/page.tsx");
const studentEditPage = read("../../app/[locale]/students/[personId]/edit/page.tsx");
const studentPlacementPage = read("../../app/[locale]/students/[personId]/placement/page.tsx");

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

  it("shows only real linked student documents and keeps downloads private", () => {
    expect(documentsPage).toContain("student-documents/${studentPersonId}");
    expect(studentDocuments).toContain('in("target_type", ["student", "person"])');
    expect(studentDocuments).toContain('operatorHasPermissions(workspace, ["documents.file.read"])');
    expect(studentDocumentsPage).toContain("No required-document checklist is configured");
    expect(studentDocumentDownload).toContain('startsWith(`${workspace.tenantId}/`)');
    expect(studentDocumentDownload).toContain('storage.from("tenant-documents").createSignedUrl');
  });


  it("keeps teacher read surfaces separate from private document, ID-generation, and mutation permissions", () => {
    expect(studentDetailPage).toContain('operatorHasPermissions(workspace, ["documents.file.read"])');
    expect(studentDetailPage).toContain('operatorHasPermissions(workspace, ["document.job.manage"])');
    expect(studentDetailPage).toContain('canGenerateDocuments ? <Link className="action-button action-button-primary"');
    expect(studentDetailPage).toContain('canReadDocuments ? <Link className="action-button" href={`/${locale}/documents/student-documents/${personId}`}');
    expect(documentsLayout).toContain('requireOfficeSurface(locale, ["documents.file.read"])');
    expect(studentDocuments).toContain('operatorHasPermissions(workspace, ["documents.file.read"])');
    expect(studentDocumentDownload).toContain('operatorHasPermissions(workspace, ["documents.file.read"])');
    expect(singleIdLayout).toContain('requireOfficeSurface(locale, ["document.job.manage", "students.profile.read"])');
    expect(batchIdLayout).toContain('requireOfficeSurface(locale, ["document.job.manage", "students.profile.read"])');
    expect(singleId).toContain('operatorHasPermissions(workspace, ["document.job.manage"])');
    expect(batchIdList).toContain('operatorHasPermissions(workspace, ["document.job.manage"])');
    expect(batchId).toContain('operatorHasPermissions(workspace, ["document.job.manage"])');
    expect(batchPdf).toContain('operatorHasPermissions(workspace, ["document.job.manage", "students.profile.read"])');
    expect(studentEditPage).toContain('operatorHasPermissions(workspace, ["people.person.manage", "students.profile.update"])');
    expect(studentPlacementPage).toContain('operatorHasPermissions(workspace, ["academics.enrollment.manage"])');
  });

  it("removes the previous tenant-scoped private photo object after a successful replacement", () => {
    expect(photoUpload).toContain("previous_storage_path");
    expect(photoUpload).toContain("expectedPrefix");
    expect(photoUpload).toContain("await bucket.remove([previousStoragePath])");
  });
});

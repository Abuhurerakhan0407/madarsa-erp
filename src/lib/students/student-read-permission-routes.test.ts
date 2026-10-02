import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  workspace: vi.fn(),
  permission: vi.fn(),
  teacherPersonId: vi.fn(),
  assignedEnrollment: vi.fn(),
  personMaybeSingle: vi.fn(),
  signedUrl: vi.fn(),
  documentStatus: vi.fn()
}));

vi.mock("@/lib/supabase/identity", () => ({ getVerifiedIdentity: mocks.identity }));
vi.mock("@/lib/tenancy/context", () => ({ getTenantContext: mocks.workspace }));
vi.mock("@/lib/access/operator-permission", () => ({ operatorHasPermissions: mocks.permission }));
vi.mock("@/lib/students/teacher-scope", () => ({
  getVerifiedTeacherPersonId: mocks.teacherPersonId,
  getTeacherAssignedEnrollment: mocks.assignedEnrollment
}));
vi.mock("@/lib/documents/student-files", () => ({ getStudentDocumentStatus: mocks.documentStatus }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: mocks.personMaybeSingle }) })
      })
    }),
    storage: { from: () => ({ createSignedUrl: mocks.signedUrl }) }
  })
}));
import { GET as getStudentPhoto } from "@/app/api/students/photo/[personId]/route";
import { GET as getIdCardPdf } from "@/app/api/students/id-cards/pdf/route";
import { GET as getStudentDocumentDownload } from "@/app/api/students/[personId]/documents/[documentId]/download/route";

const identity = { id: "teacher-identity" };
const workspace = {
  identityId: "teacher-identity",
  membershipId: 77,
  tenantId: 1,
  tenantName: "Ilmgaah School",
  tenantSlug: "ilmgaah-school",
  tenantState: "active",
  clientProfile: "full-product",
  branchId: 10,
  branchName: "Main",
  branchCode: "MAIN",
  displayName: "Teacher"
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.identity.mockResolvedValue(identity);
  mocks.workspace.mockResolvedValue(workspace);
  mocks.teacherPersonId.mockResolvedValue(900);
  mocks.assignedEnrollment.mockResolvedValue({ id: 7001, student_person_id: 501, group_id: 41, session_id: 71, program_id: 81, status: "active" });
  mocks.personMaybeSingle.mockResolvedValue({ data: { photo_storage_path: "1/students/501/photo.jpg" }, error: null });
  mocks.signedUrl.mockResolvedValue({ data: { signedUrl: "https://storage.example.test/photo" }, error: null });
  mocks.documentStatus.mockResolvedValue(null);
});
describe("student photo teacher authorization", () => {
  it("allows an assigned teacher to read the same student photo surface", async () => {
    mocks.permission.mockImplementation(async (_workspace: unknown, permissions: string[]) => permissions.includes("students.profile.read"));
    const response = await getStudentPhoto(new Request("https://erp.example.test/api/students/photo/501"), { params: Promise.resolve({ personId: "501" }) });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://storage.example.test/photo");
    expect(mocks.assignedEnrollment).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 1, branchId: 10 }), 900, 501, expect.anything());
  });

  it("denies an unassigned teacher before loading photo metadata", async () => {
    mocks.permission.mockImplementation(async (_workspace: unknown, permissions: string[]) => permissions.includes("students.profile.read"));
    mocks.assignedEnrollment.mockResolvedValueOnce(null);
    const response = await getStudentPhoto(new Request("https://erp.example.test/api/students/photo/501"), { params: Promise.resolve({ personId: "501" }) });
    expect(response.status).toBe(404);
    expect(mocks.personMaybeSingle).not.toHaveBeenCalled();
    expect(mocks.signedUrl).not.toHaveBeenCalled();
  });

  it("denies a cross-branch teacher scope before loading photo metadata", async () => {
    mocks.permission.mockImplementation(async (_workspace: unknown, permissions: string[]) => permissions.includes("students.profile.read"));
    mocks.workspace.mockResolvedValueOnce({ ...workspace, branchId: 20 });
    mocks.assignedEnrollment.mockResolvedValueOnce(null);
    const response = await getStudentPhoto(new Request("https://erp.example.test/api/students/photo/501"), { params: Promise.resolve({ personId: "501" }) });
    expect(response.status).toBe(404);
    expect(mocks.assignedEnrollment).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 1, branchId: 20 }), 900, 501, expect.anything());
    expect(mocks.personMaybeSingle).not.toHaveBeenCalled();
  });

  it("denies a cross-tenant teacher scope before loading photo metadata", async () => {
    mocks.permission.mockImplementation(async (_workspace: unknown, permissions: string[]) => permissions.includes("students.profile.read"));
    mocks.workspace.mockResolvedValueOnce({ ...workspace, tenantId: 2 });
    mocks.assignedEnrollment.mockResolvedValueOnce(null);
    const response = await getStudentPhoto(new Request("https://erp.example.test/api/students/photo/501"), { params: Promise.resolve({ personId: "501" }) });
    expect(response.status).toBe(404);
    expect(mocks.assignedEnrollment).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 2, branchId: 10 }), 900, 501, expect.anything());
    expect(mocks.personMaybeSingle).not.toHaveBeenCalled();
  });

  it("fails closed when there is no active branch", async () => {
    mocks.workspace.mockResolvedValueOnce({ ...workspace, branchId: null });
    const response = await getStudentPhoto(new Request("https://erp.example.test/api/students/photo/501"), { params: Promise.resolve({ personId: "501" }) });
    expect(response.status).toBe(403);
    expect(mocks.assignedEnrollment).not.toHaveBeenCalled();
    expect(mocks.personMaybeSingle).not.toHaveBeenCalled();
  });

  it("denies when active workspace identity does not match the verified caller", async () => {
    mocks.workspace.mockResolvedValueOnce({ ...workspace, identityId: "other-identity" });
    const response = await getStudentPhoto(new Request("https://erp.example.test/api/students/photo/501"), { params: Promise.resolve({ personId: "501" }) });
    expect(response.status).toBe(403);
    expect(mocks.assignedEnrollment).not.toHaveBeenCalled();
  });
});
describe("private student document server guards", () => {
  it("denies bulk ID-card PDF generation without document.job.manage and student read", async () => {
    mocks.permission.mockResolvedValue(false);
    const response = await getIdCardPdf(new Request("https://erp.example.test/api/students/id-cards/pdf?session=71&group=41&student=501"));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Student ID-card generation permission required." });
    expect(mocks.permission).toHaveBeenCalledWith(expect.objectContaining({ branchId: 10 }), ["document.job.manage", "students.profile.read"]);
  });

  it("denies signed student document download without documents.file.read", async () => {
    mocks.permission.mockResolvedValue(false);
    const response = await getStudentDocumentDownload(
      new Request("https://erp.example.test/api/students/501/documents/801/download"),
      { params: Promise.resolve({ personId: "501", documentId: "801" }) }
    );
    expect(response.status).toBe(403);
    expect(mocks.documentStatus).not.toHaveBeenCalled();
    expect(mocks.signedUrl).not.toHaveBeenCalled();
  });

  it("does not treat student read permission as ID-generation permission", async () => {
    const granted = new Set(["students.profile.read"]);
    mocks.permission.mockImplementation(async (_workspace: unknown, permissions: string[]) => permissions.every((permission) => granted.has(permission)));
    const response = await getIdCardPdf(new Request("https://erp.example.test/api/students/id-cards/pdf?session=71&group=41&student=501"));
    expect(response.status).toBe(403);
  });
});

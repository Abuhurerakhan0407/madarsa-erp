import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  workspace: vi.fn(),
  detail: vi.fn(),
  placement: vi.fn(),
  batch: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); })
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/access/operator-permission", () => ({ operatorHasPermissions: mocks.permission }));
vi.mock("@/lib/tenancy/context", () => ({ getTenantContext: mocks.workspace }));
vi.mock("@/lib/students/detail", () => ({ getStudentDetail: mocks.detail }));
vi.mock("@/lib/students/placement", () => ({ getStudentPlacement: mocks.placement }));
vi.mock("@/lib/students/id-card-batch", () => ({
  getStudentIdCardBatch: mocks.batch,
  normalizeIdCardStudentIds: (value: string | string[] | undefined) => {
    const raw = Array.isArray(value) ? value : value ? [value] : [];
    return raw.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0);
  }
}));

import { getStudentDocumentStatus } from "@/lib/documents/student-files";
import StudentIdCardPage from "@/app/[locale]/students/[personId]/id-card/page";
import StudentEditPage from "@/app/[locale]/students/[personId]/edit/page";
import StudentPlacementPage from "@/app/[locale]/students/[personId]/placement/page";
import BulkIdCardsPage from "@/app/[locale]/students/id-cards/page";
import BulkIdCardPrintPage from "@/app/[locale]/students/id-cards/print/page";

const workspace = {
  identityId: "teacher-identity", membershipId: 77, tenantId: 1,
  tenantName: "Ilmgaah", tenantSlug: "ilmgaah", tenantState: "active",
  clientProfile: "full-product", branchId: 10, branchName: "Main", branchCode: "MAIN", displayName: "Teacher"
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspace.mockResolvedValue(workspace);
  mocks.permission.mockResolvedValue(false);
});

describe("student ID document page permissions", () => {
  it("private student document status fails closed without documents.file.read", async () => {
    mocks.detail.mockResolvedValue({ personId: 501, name: "Student", nativeName: null, studentNumber: "S-501" });
    await expect(getStudentDocumentStatus(501, "en")).resolves.toBeNull();
    expect(mocks.permission).toHaveBeenCalledWith(expect.objectContaining({ branchId: 10 }), ["documents.file.read"]);
  });

  it("single ID page fails closed without document.job.manage", async () => {
    await expect(StudentIdCardPage({ params: Promise.resolve({ locale: "en", personId: "501" }) })).rejects.toThrow("NOT_FOUND");
    expect(mocks.permission).toHaveBeenCalledWith(expect.objectContaining({ branchId: 10 }), ["document.job.manage"]);
    expect(mocks.detail).not.toHaveBeenCalled();
  });

  it("batch ID selection fails closed without document.job.manage", async () => {
    await expect(BulkIdCardsPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ session: "71", group: "41" })
    })).rejects.toThrow("NOT_FOUND");
    expect(mocks.permission).toHaveBeenCalledWith(expect.objectContaining({ branchId: 10 }), ["document.job.manage"]);
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it("bulk ID print fails closed without document.job.manage", async () => {
    await expect(BulkIdCardPrintPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ session: "71", group: "41", student: "501" })
    })).rejects.toThrow("NOT_FOUND");
    expect(mocks.permission).toHaveBeenCalledWith(expect.objectContaining({ branchId: 10 }), ["document.job.manage"]);
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it("student read alone does not grant edit or placement access", async () => {
    mocks.permission.mockImplementation(async (_workspace: unknown, permissions: string[]) => permissions.includes("students.profile.read"));
    await expect(StudentEditPage({ params: Promise.resolve({ locale: "en", personId: "501" }) })).rejects.toThrow("NOT_FOUND");
    await expect(StudentPlacementPage({ params: Promise.resolve({ locale: "en", personId: "501" }) })).rejects.toThrow("NOT_FOUND");
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(mocks.placement).not.toHaveBeenCalled();
  });
});

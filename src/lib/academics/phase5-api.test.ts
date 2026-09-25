import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mutationRoute = readFileSync(
  resolve(process.cwd(), "src/app/api/academics/route.ts"),
  "utf8"
);
const attachmentRoute = readFileSync(
  resolve(process.cwd(), "src/app/api/academics/attachment/route.ts"),
  "utf8"
);

describe("Phase 5 Academics API boundaries", () => {
  it("validates same-origin JSON before authentication and privileged work", () => {
    expect(mutationRoute).toContain("isSameOriginRequest(request)");
    expect(mutationRoute).toContain("isJsonRequest(request)");
    expect(mutationRoute).toMatch(/readBoundedJson\(request,\s*32_768\)/);
    expect(mutationRoute.indexOf("validateAcademicMutation")).toBeLessThan(
      mutationRoute.indexOf("getVerifiedIdentity()")
    );
  });

  it("derives identity tenant and branch from the verified workspace", () => {
    expect(mutationRoute).toMatch(/p_identity_id:\s*identity\.id/);
    expect(mutationRoute).toMatch(/p_tenant_id:\s*workspace\.tenantId/);
    expect(mutationRoute).toMatch(/p_branch_id:\s*workspace\.branchId/);
    expect(mutationRoute).not.toContain("parsed.value.tenantId");
    expect(mutationRoute).not.toContain("parsed.value.branchId");
  });

  it("hashes raw attachment tokens server-side and removes them from the mutation payload", () => {
    expect(mutationRoute).toContain('createHash("sha256")');
    expect(mutationRoute).toContain("delete payload.attachmentToken");
    expect(mutationRoute).toMatch(
      /p_attachment_token_digest:\s*attachmentDigest/
    );
    expect(mutationRoute).toContain('admin.rpc("mutate_academics_timetable_v2"');
  });

  it("checks upload permission before private storage write", () => {
    expect(attachmentRoute).toContain("operator_has_permission_v1");
    expect(attachmentRoute).toContain("academics.homework.manage");
    expect(attachmentRoute).toContain("academics.structure.manage");
    expect(attachmentRoute.indexOf("operator_has_permission_v1")).toBeLessThan(
      attachmentRoute.indexOf("bucket.upload")
    );
  });

  it("validates actual attachment signatures and never returns storage paths", () => {
    expect(attachmentRoute).toContain("detectAcademicAttachmentType(bytes)");
    expect(attachmentRoute).toContain("attachment.type !== detected");
    expect(attachmentRoute).toContain("attachmentToken: token");
    expect(attachmentRoute).not.toContain("storagePath, expiresAt");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const detailSource = readFileSync(new URL("./detail.ts", import.meta.url), "utf8");

describe("student detail protected reads", () => {
  it("resolves authoritative audience before any privileged student relationship read", () => {
    const audienceIndex = detailSource.indexOf("const audience = await getNavigationAudience(workspace)");
    const relationshipIndex = detailSource.indexOf('admin.from("person_relationships")');

    expect(audienceIndex).toBeGreaterThanOrEqual(0);
    expect(relationshipIndex).toBeGreaterThan(audienceIndex);
  });

  it("requires a verified employee identity and active timetable group for teacher detail access", () => {
    expect(detailSource).toContain('if (audience === "teacher")');
    expect(detailSource).toContain('.from("identity_person_links")');
    expect(detailSource).toContain('.eq("link_type", "employee")');
    expect(detailSource).toContain('.eq("status", "verified")');
    expect(detailSource).toContain('.from("timetable_entries")');
    expect(detailSource).toContain('.eq("teacher_person_id", teacherLink.data.person_id)');
    expect(detailSource).toContain('.in("group_id", groupIds)');
    expect(detailSource).toContain("if (!assignedEnrollment.data) return null;");
  });

  it("checks teacher assignment before privileged guardian/contact reads", () => {
    const assignedIndex = detailSource.indexOf("if (!assignedEnrollment.data) return null;");
    const relationshipIndex = detailSource.indexOf('admin.from("person_relationships")');
    const contactIndex = detailSource.indexOf('admin.from("person_contacts")');

    expect(assignedIndex).toBeGreaterThanOrEqual(0);
    expect(relationshipIndex).toBeGreaterThan(assignedIndex);
    expect(contactIndex).toBeGreaterThan(assignedIndex);
  });

  it("keeps tenant and branch scope on teacher assignment queries", () => {
    expect(detailSource).toContain('.eq("tenant_id", workspace.tenantId)');
    expect(detailSource).toContain('.eq("branch_id", workspace.branchId)');
    expect(detailSource).toContain('.eq("student_person_id", personId)');
  });

  it("does not authorize from editable user metadata", () => {
    expect(detailSource).not.toContain("raw_user_meta_data");
    expect(detailSource).not.toContain("user_metadata");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const detailSource = readFileSync(new URL("./detail.ts", import.meta.url), "utf8");

describe("student detail protected guardian reads", () => {
  it("verifies branch association before creating a privileged client", () => {
    const associationIndex = detailSource.indexOf('const association = await supabase.from("enrollments")');
    const adminIndex = detailSource.indexOf("const admin = createAdminClient();");

    expect(associationIndex).toBeGreaterThanOrEqual(0);
    expect(detailSource).toContain("if (!association.data) return null;");
    expect(adminIndex).toBeGreaterThan(associationIndex);
  });

  it("uses the server-only admin client for tables intentionally unavailable to authenticated users", () => {
    expect(detailSource).toContain('admin.from("person_relationships")');
    expect(detailSource).toContain('admin.from("person_contacts")');
    expect(detailSource).not.toContain('supabase.from("person_relationships")');
    expect(detailSource).not.toContain('supabase.from("person_contacts")');
  });

  it("keeps ordinary student and guardian identity reads on the scoped authenticated client", () => {
    expect(detailSource).toContain('supabase.from("persons")');
    expect(detailSource).toContain('supabase.from("guardian_profiles")');
  });
});

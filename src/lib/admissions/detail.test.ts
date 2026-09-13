import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantContext } from "@/lib/tenancy/context";
import { getAdmissionDetail } from "./detail";

const fixtures = vi.hoisted(() => ({ rows: {} as Record<string, unknown>, queried: [] as string[] }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      fixtures.queried.push(table);
      const result = { data: fixtures.rows[table] ?? null, error: null };
      const query = {
        select: () => query, eq: () => query, order: () => query, limit: () => query,
        is: () => query, gt: () => query,
        maybeSingle: () => Promise.resolve(result),
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve)
      };
      return query;
    }
  })
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      fixtures.queried.push(table);
      const result = { data: fixtures.rows[table] ?? null, error: null };
      const query = {
        select: () => query, eq: () => query, order: () => query, limit: () => query,
        is: () => query, gt: () => query,
        maybeSingle: () => Promise.resolve(result),
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve)
      };
      return query;
    }
  })
}));

const workspace = { tenantId: 1 } as TenantContext;

beforeEach(() => {
  fixtures.queried = [];
  fixtures.rows = {
    applications: { id: 11, state: "enrolled", revision: 5, applicant_person_id: 4, applicant_data: {}, program_id: 1, session_id: 1, branch_id: 1 },
    application_reviews: [], admission_decisions: [],
    student_profiles: { person_id: 4, student_number: "STU-00001" },
    admission_conversions: { student_person_id: 4, enrollment_id: 3 },
    enrollments: { id: 999 }
  };
});

describe("admission detail conversion linkage", () => {
  it("uses the immutable original enrollment even when a newer enrollment exists", async () => {
    const detail = await getAdmissionDetail(workspace, 11);
    expect(detail?.convertedStudent?.enrollmentId).toBe(3);
    expect(fixtures.queried).not.toContain("enrollments");
  });

  it("does not guess a conversion when its permanent linkage is missing", async () => {
    fixtures.rows.admission_conversions = null;
    expect((await getAdmissionDetail(workspace, 11))?.convertedStudent).toBeNull();
  });

  it("does not present an unconverted application as enrolled", async () => {
    fixtures.rows.applications = { ...(fixtures.rows.applications as object), state: "offered" };
    expect((await getAdmissionDetail(workspace, 11))?.convertedStudent).toBeNull();
    expect(fixtures.queried).not.toContain("admission_conversions");
  });
});

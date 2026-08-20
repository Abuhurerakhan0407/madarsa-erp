import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contract = readFileSync(
  new URL("../../../database/contracts/phase4_people_academics.sql", import.meta.url),
  "utf8"
);

const tables = [
  "institution_profiles",
  "persons",
  "person_contacts",
  "student_profiles",
  "guardian_profiles",
  "employee_profiles",
  "person_relationships",
  "identity_person_links",
  "academic_sessions",
  "programs",
  "academic_levels",
  "academic_groups",
  "subjects",
  "books",
  "curriculum_assignments",
  "enrollments",
  "enrollment_events",
  "academic_calendar_events",
  "timetable_slots",
  "timetable_entries",
  "documents",
  "document_versions",
  "document_links"
] as const;

describe("Phase 4 database contract", () => {
  it("declares every people, academic, and document table", () => {
    for (const table of tables) {
      expect(contract).toContain(`create table public.${table}`);
    }
  });

  it("enables and forces RLS everywhere", () => {
    for (const table of tables) {
      expect(contract).toContain(`alter table public.${table} enable row level security`);
      expect(contract).toContain(`alter table public.${table} force row level security`);
    }
  });

  it("keeps browser writes closed", () => {
    expect(contract).not.toMatch(/grant\s+(insert|update|delete|all)/i);
    expect(contract).not.toMatch(/for\s+(insert|update|delete|all)\s+to\s+authenticated/i);
  });

  it("preserves active enrollment uniqueness and history", () => {
    expect(contract).toContain("enrollments_active_program_idx");
    expect(contract).toContain("where status = 'active'");
    expect(contract).toContain("enrollment_events_append_only");
  });

  it("keeps contacts, relationships, identity links, and document links server-only", () => {
    const grantBlock = contract.slice(contract.indexOf("grant select on table"));
    expect(grantBlock).not.toContain("public.person_contacts,");
    expect(grantBlock).not.toContain("public.person_relationships,");
    expect(grantBlock).not.toContain("public.identity_person_links,");
    expect(grantBlock).not.toContain("public.document_links");
  });

  it("requires tenant-scoped foreign keys", () => {
    expect(contract).toContain("foreign key (tenant_id, student_person_id)");
    expect(contract).toContain("foreign key (tenant_id, teacher_person_id)");
    expect(contract).toContain("foreign key (tenant_id, document_id)");
  });
});

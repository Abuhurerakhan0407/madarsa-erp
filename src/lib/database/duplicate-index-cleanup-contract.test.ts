import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20260901063000_remove_duplicate_indexes.sql", import.meta.url),
  "utf8"
);

describe("duplicate index cleanup migration", () => {
  it("drops only the four redundant advisor-reported indexes", () => {
    const redundant = [
      "marksheets_series_subject_idx",
      "recitation_attempts_student_idx",
      "recitation_sessions_branch_idx",
      "revision_obligations_student_idx"
    ];

    for (const index of redundant) {
      expect(migration).toContain(`DROP INDEX IF EXISTS public.${index};`);
    }
  });

  it("preserves the equivalent indexes selected by PostgreSQL", () => {
    const retained = [
      "marksheets_subject_state_idx",
      "recitation_attempts_student_date_idx",
      "recitation_sessions_branch_date_idx",
      "revision_obligations_student_due_idx"
    ];

    for (const index of retained) {
      expect(migration).not.toContain(`DROP INDEX IF EXISTS public.${index};`);
    }
  });
});

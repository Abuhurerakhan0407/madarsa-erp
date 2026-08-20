import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contract = readFileSync(
  new URL("../../../database/contracts/phase8_assessment.sql", import.meta.url),
  "utf8"
);

const tables = [
  "curriculum_versions", "curriculum_version_items", "curriculum_units",
  "curriculum_coverage_events", "grading_scale_versions", "grading_bands",
  "exam_series", "exam_subjects", "assessment_components", "exam_schedules",
  "marksheets", "mark_entries", "mark_entry_versions", "mark_moderations",
  "result_runs", "result_snapshots", "result_subject_snapshots",
  "result_publications", "promotion_decisions", "report_card_issues"
] as const;

describe("Phase 8 database contract", () => {
  it("declares curriculum and assessment records", () => {
    for (const table of tables) expect(contract).toContain(`create table public.${table}`);
  });

  it("pins reproducible inputs", () => {
    expect(contract).toContain("curriculum_version_id bigint not null");
    expect(contract).toContain("grading_scale_version_id bigint not null");
    expect(contract).toContain("input_digest text not null");
    expect(contract).toContain("calculation_trace jsonb not null");
  });

  it("keeps mark history and corrections", () => {
    expect(contract).toContain("mark_entry_versions_append_only");
    expect(contract).toContain("before_version integer not null");
    expect(contract).toContain("supersedes_snapshot_id bigint");
  });

  it("exposes only published portal results", () => {
    expect(contract).toContain("state = 'published' and private.has_relationship");
  });

  it("keeps browser writes closed", () => {
    expect(contract).not.toMatch(/grant\s+(insert|update|delete|all)/i);
  });
});

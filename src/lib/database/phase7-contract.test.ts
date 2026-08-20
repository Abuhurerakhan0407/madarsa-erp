import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contract = readFileSync(
  new URL("../../../database/contracts/phase7_learning.sql", import.meta.url),
  "utf8"
);

const tables = [
  "quran_editions", "quran_references", "quran_page_mappings", "learning_plans",
  "learning_plan_items", "recitation_sessions", "recitation_attempts",
  "recitation_mistakes", "revision_obligations", "learning_strength_snapshots",
  "learning_milestones", "reading_curricula", "reading_curriculum_versions",
  "reading_units", "reading_attempts"
] as const;

describe("Phase 7 database contract", () => {
  it("declares Quran and reading learning records", () => {
    for (const table of tables) expect(contract).toContain(`create table public.${table}`);
  });

  it("pins Quran references and curriculum versions", () => {
    expect(contract).toContain("canonical_ordinal integer not null unique");
    expect(contract).toContain("unique (tenant_id, curriculum_id, version)");
    expect(contract).toContain("evaluation_snapshot jsonb not null");
  });

  it("keeps evaluations append-only", () => {
    expect(contract).toContain("recitation_attempts_append_only");
    expect(contract).toContain("recitation_mistakes_append_only");
    expect(contract).toContain("learning_strength_append_only");
    expect(contract).toContain("reading_attempts_append_only");
  });

  it("separates parent-safe remarks", () => {
    expect(contract).toContain("private_note text");
    expect(contract).toContain("parent_visible_remark text");
  });

  it("keeps browser writes closed", () => {
    expect(contract).not.toMatch(/grant\s+(insert|update|delete|all)/i);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "database/contracts/phase3_configuration.sql"),
  "utf8"
).toLowerCase();

const tenantTables = [
  "config_values",
  "terminology_sets",
  "terminology_entries",
  "custom_field_definitions",
  "custom_field_values",
  "form_definitions",
  "form_versions",
  "status_definitions",
  "status_transitions",
  "workflow_definitions",
  "workflow_versions",
  "workflow_instances",
  "workflow_tasks",
  "grade_scales",
  "grade_scale_versions",
  "attendance_status_sets",
  "template_definitions",
  "template_versions",
  "number_sequences",
  "tenant_setup_progress"
] as const;

const platformTables = ["config_definitions", "configuration_presets"] as const;

describe("Phase 3 configuration database contract", () => {
  it("defines every governed configuration domain", () => {
    for (const table of [...tenantTables, ...platformTables]) {
      expect(sql).toContain(`create table public.${table}`);
    }
  });

  it("enables and forces RLS everywhere", () => {
    for (const table of [...tenantTables, ...platformTables]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`alter table public.${table} force row level security`);
    }
  });

  it("requires configuration permissions", () => {
    expect(sql).toContain("settings.configuration.read");
    expect(sql).toContain("settings.configuration.manage");
    expect(sql).toContain("settings.configuration.publish");
    expect(sql).toContain("private.has_permission(tenant_id, 'settings.configuration.read'");
  });

  it("protects published history and core semantics", () => {
    expect(sql).toContain("protect_published_configuration");
    expect(sql).toContain("published configuration is immutable");
    expect(sql).toContain("protect_core_status_definition");
    expect(sql).toContain("core status semantics cannot be changed or archived");
    expect(sql).toContain("workflow_version_id bigint not null");
    expect(sql).toContain("private.reserve_number_sequence");
    expect(sql).toContain("security invoker");
  });

  it("keeps browser writes denied", () => {
    expect(sql).toContain("revoke insert, update, delete, truncate, references, trigger");
    expect(sql).not.toMatch(/create policy[\s\S]{0,120}for (?:insert|update|delete)/);
    expect(sql).not.toMatch(/grant\s+(?:insert|update|delete|all)[\s\S]{0,180}\s+to\s+authenticated/);
    expect(sql).toContain("revoke all on all tables in schema public from anon");
    expect(sql).not.toContain("custom_field_values_select_authorized");
    expect(sql).not.toContain("workflow_instances_select_authorized");
  });

  it("supports five editable onboarding presets", () => {
    expect(sql).toContain("insert into public.configuration_presets");
    expect(sql).toContain("insert into public.config_definitions");
    for (const preset of [
      "maktab",
      "hifz_academy",
      "dars_e_nizami",
      "islamic_school",
      "urdu_medium_school"
    ]) {
      expect(sql).toContain(`'${preset}'`);
    }
    expect(sql).toContain("tenant_setup_progress");
  });

  it("indexes resolution and workflow paths", () => {
    expect(sql).toContain("config_values_resolution_idx");
    expect(sql).toContain("terminology_sets_resolution_idx");
    expect(sql).toContain("workflow_versions_published_idx");
    expect(sql).toContain("workflow_instances_subject_idx");
    expect(sql).toContain("number_sequences_lookup_idx");
  });
});

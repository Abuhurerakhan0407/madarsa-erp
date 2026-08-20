import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contract = readFileSync(new URL("../../../database/contracts/phase12_communications.sql", import.meta.url), "utf8");
const required = ["document_templates","document_template_versions","document_generation_jobs","issued_document_records","notification_channel_configs","notification_policies","notification_templates","domain_notification_events","notification_recipient_resolutions","notification_dispatches","notification_delivery_events","bulk_message_campaigns","communication_usage_daily","data_import_jobs","data_import_rows","report_definitions","report_runs"] as const;

describe("Phase 12 database contract", () => {
  it("declares document, messaging, and data-job records", () => {
    for (const table of required) expect(contract).toContain(`create table public.${table}`);
  });
  it("makes dispatch and webhooks idempotent", () => {
    expect(contract).toContain("unique (tenant_id, idempotency_key)");
    expect(contract).toContain("notification_delivery_provider_idx");
  });
  it("stores audience and cost previews", () => {
    expect(contract).toContain("audience_count integer not null");
    expect(contract).toContain("estimated_cost numeric(18,4)");
  });
  it("keeps browser writes closed", () => {
    expect(contract).not.toMatch(/grant\s+(insert|update|delete|all)/i);
  });
});

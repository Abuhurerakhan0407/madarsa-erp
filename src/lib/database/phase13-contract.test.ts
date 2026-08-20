import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contract = readFileSync(new URL("../../../database/contracts/phase13_saas.sql", import.meta.url), "utf8");
const required = ["saas_plans","saas_price_versions","tenant_subscriptions","subscription_checkout_intents","subscription_provider_events","saas_billing_invoices","saas_billing_payments","saas_usage_events","saas_usage_snapshots","tenant_entitlement_overrides","platform_tenant_actions","platform_feature_flags","tenant_feature_assignments","support_impersonation_sessions","platform_support_cases","platform_job_controls"] as const;

describe("Phase 13 database contract", () => {
  it("declares subscription and platform-control records", () => {
    for (const table of required) expect(contract).toContain(`create table public.${table}`);
  });
  it("versions quarterly and yearly prices independently", () => {
    expect(contract).toContain("billing_interval in ('quarterly','yearly')");
    expect(contract).toContain("unique (plan_id, market, currency_code, billing_interval, version)");
  });
  it("makes provider and usage events idempotent", () => {
    expect(contract).toContain("unique (provider, provider_event_id)");
    expect(contract).toContain("unique (tenant_id, idempotency_key)");
  });
  it("keeps platform controls service-only", () => {
    expect(contract).not.toContain("grant select on table public.platform_feature_flags");
    expect(contract).not.toMatch(/grant\s+(insert|update|delete|all)/i);
  });
});

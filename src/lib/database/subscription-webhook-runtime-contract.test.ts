import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20260901073000_subscription_webhook_runtime.sql", import.meta.url),
  "utf8"
);

describe("subscription webhook runtime migration", () => {
  it("keeps provider event ingestion service-role only", () => {
    expect(migration).toContain(
      "revoke all on function public.record_subscription_provider_event_v1(text, text, text, timestamptz, text, text) from public, anon, authenticated;"
    );
    expect(migration).toContain(
      "grant execute on function public.record_subscription_provider_event_v1(text, text, text, timestamptz, text, text) to service_role;"
    );
  });

  it("records only a digest and never accepts a raw provider payload", () => {
    expect(migration).toContain("p_payload_digest text");
    expect(migration).not.toMatch(/p_(raw_)?payload\s+(json|jsonb|text)/i);
    expect(migration).toContain("payload_digest");
  });

  it("derives tenant and subscription from the stored provider subscription id", () => {
    expect(migration).toContain("from public.tenant_subscriptions");
    expect(migration).toContain("provider_subscription_id = p_provider_subscription_id");
    expect(migration).not.toMatch(/p_tenant_id/);
  });

  it("is idempotent and handles unsupported, unknown, and stale events explicitly", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("'unknown_subscription'");
    expect(migration).toContain("'unsupported_event'");
    expect(migration).toContain("'ignored_stale'");
    expect(migration).toContain("'verified_awaiting_reconciliation'");
  });

  it("does not mutate normalized subscription state in the ingestion slice", () => {
    expect(migration).not.toMatch(/set\s+normalized_state\s*=/i);
    expect(migration).not.toMatch(/update\s+public\.saas_billing_(payments|invoices)/i);
  });
});

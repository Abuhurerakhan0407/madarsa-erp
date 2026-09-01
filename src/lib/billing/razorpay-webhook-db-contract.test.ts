import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationsDir).find((name) =>
  name.endsWith("_harden_subscription_webhook_idempotency.sql")
);

if (!migrationName) {
  throw new Error("Missing subscription webhook idempotency hardening migration.");
}

const sql = readFileSync(join(migrationsDir, migrationName), "utf8");

describe("Razorpay provider-event idempotency database contract", () => {
  it("keeps exact duplicate payloads idempotent", () => {
    expect(sql).toMatch(/v_existing\.payload_digest\s*=\s*p_payload_digest/i);
    expect(sql).toMatch(/'duplicate'\s*,\s*true[\s\S]*?'integrity_conflict'\s*,\s*false/i);
  });

  it("quarantines and records reused event ids with a different payload digest", () => {
    expect(sql).toContain("subscription_provider_event_conflicts");
    expect(sql).toMatch(/on conflict \(original_event_id, payload_digest\) do nothing/i);
    expect(sql).toMatch(/'processing_state'\s*,\s*'quarantined'/i);
    expect(sql).toMatch(/'integrity_conflict'\s*,\s*true/i);
  });

  it("preserves the original provider-event row rather than overwriting its evidence", () => {
    expect(sql).not.toMatch(/update\s+public\.subscription_provider_events/i);
    expect(sql).toMatch(/references public\.subscription_provider_events\(id\) on delete restrict/i);
  });

  it("keeps the conflict evidence table outside browser-role access", () => {
    expect(sql).toMatch(/alter table public\.subscription_provider_event_conflicts enable row level security/i);
    expect(sql).toMatch(
      /revoke all on table public\.subscription_provider_event_conflicts from public, anon, authenticated/i
    );
  });
});

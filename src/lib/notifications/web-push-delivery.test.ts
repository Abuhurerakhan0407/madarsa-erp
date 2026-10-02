import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const migration = source(
  "supabase/migrations/20260922030000_portal_push_delivery_ledger.sql"
);
const sender = source("src/lib/notifications/web-push-delivery.ts");
const ingest = source("src/app/api/attendance/device-ingest/route.ts");
const pkg = JSON.parse(source("package.json")) as {
  dependencies?: Record<string, string>;
};

describe("biometric arrival web push delivery", () => {
  it("uses a dedicated idempotent service-role-only delivery ledger", () => {
    expect(migration).toContain(
      "create table if not exists public.portal_push_deliveries"
    );
    expect(migration).toContain(
      "unique (tenant_id,event_id,subscription_id)"
    );
    expect(migration).toContain(
      "alter table public.portal_push_deliveries force row level security"
    );
    expect(migration).toContain(
      "revoke all on public.portal_push_deliveries from public,anon,authenticated"
    );
    expect(migration).toContain(
      "create or replace function public.reserve_portal_push_delivery_v1"
    );
    expect(migration).toContain(
      "create or replace function public.finish_portal_push_delivery_v1"
    );
  });

  it("keeps push disabled unless all VAPID delivery settings exist", () => {
    expect(sender).toContain('process.env.WEB_PUSH_DELIVERY_ENABLED !== "1"');
    expect(sender).toContain("NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY");
    expect(sender).toContain("WEB_PUSH_VAPID_PRIVATE_KEY");
    expect(sender).toContain("webpush.setVapidDetails");
  });

  it("only selects the biometric-arrival domain event", () => {
    expect(sender).toContain('"attendance.biometric_arrival"');
    expect(sender).toContain('"attendance_device_event"');
    expect(sender).toContain("portal_push_subscriptions");
  });

  it("reserves before sending and records the outcome", () => {
    expect(sender).toContain('"reserve_portal_push_delivery_v1"');
    expect(sender).toContain("webpush.sendNotification");
    expect(sender).toContain('"finish_portal_push_delivery_v1"');
    expect(sender).toContain("statusCode === 404 || statusCode === 410");
  });
  it("never makes attendance ingestion depend on push success", () => {
    expect(ingest).toContain("result.auto_applied === true");
    expect(ingest).toContain('eventType === "presence"');
    expect(ingest).toContain('eventType === "check_in"');
    expect(ingest).toContain("await deliverBiometricArrivalPush(eventId)");
    expect(ingest).toContain('console.error("Biometric arrival push delivery failed."');
    expect(ingest.indexOf("try {", ingest.indexOf("deliverBiometricArrivalPush")))
      .toBeGreaterThan(-1);
  });

  it("ships the maintained web-push sender dependency", () => {
    expect(pkg.dependencies?.["web-push"]).toBeTruthy();
  });
});

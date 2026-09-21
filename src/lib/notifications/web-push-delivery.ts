import * as webpush from "web-push";
import type { PushSubscription } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

type Raw = Record<string, unknown>;
type PushFailure = Error & { statusCode?: number; body?: string };

export type PushDeliverySummary = {
  configured: boolean;
  eventFound: boolean;
  subscriptions: number;
  attempted: number;
  delivered: number;
  skipped: number;
  failed: number;
};

function object(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Raw
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
function localized(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim()) return value.trim();
  const raw = object(value);
  for (const key of ["en", "ur"]) {
    const candidate = text(raw[key]);
    if (candidate) return candidate;
  }
  for (const candidate of Object.values(raw)) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return fallback;
}

function pushConfig() {
  if (process.env.WEB_PUSH_DELIVERY_ENABLED !== "1") return null;
  const publicKey = text(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY);
  const privateKey = text(process.env.WEB_PUSH_VAPID_PRIVATE_KEY);
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject: text(process.env.WEB_PUSH_VAPID_SUBJECT) || "https://www.ilmgaah.in"
  };
}

function validSubscription(value: unknown): PushSubscription | null {
  const raw = object(value);
  const endpoint = text(raw.endpoint);
  const keys = object(raw.keys);
  const p256dh = text(keys.p256dh);
  const auth = text(keys.auth);
  return endpoint && p256dh && auth
    ? { endpoint, keys: { p256dh, auth } }
    : null;
}
export async function deliverBiometricArrivalPush(
  attendanceEventId: number
): Promise<PushDeliverySummary> {
  const summary: PushDeliverySummary = {
    configured: false,
    eventFound: false,
    subscriptions: 0,
    attempted: 0,
    delivered: 0,
    skipped: 0,
    failed: 0
  };
  const config = pushConfig();
  if (!config || !Number.isInteger(attendanceEventId) || attendanceEventId <= 0) {
    return summary;
  }
  summary.configured = true;
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  const admin = createAdminClient();
  const { data: event, error: eventError } = await admin
    .from("domain_notification_events")
    .select("id,tenant_id,payload")
    .eq("event_key", "attendance.biometric_arrival")
    .eq("aggregate_type", "attendance_device_event")
    .eq("aggregate_id", String(attendanceEventId))
    .maybeSingle();
  if (eventError) throw new Error(`Unable to load arrival notification: ${eventError.message}`);
  if (!event) return summary;
  summary.eventFound = true;

  const eventId = number(event.id);
  const tenantId = number(event.tenant_id);
  if (!eventId || !tenantId) return summary;
  const { data: resolutions, error: resolutionError } = await admin
    .from("notification_recipient_resolutions")
    .select("recipient_identity_id")
    .eq("tenant_id", tenantId)
    .eq("event_id", eventId);
  if (resolutionError) {
    throw new Error(`Unable to resolve push recipients: ${resolutionError.message}`);
  }
  const identityIds = [...new Set(
    (resolutions ?? []).map((row) => text(row.recipient_identity_id)).filter(Boolean)
  )];
  if (identityIds.length === 0) return summary;

  const { data: subscriptions, error: subscriptionError } = await admin
    .from("portal_push_subscriptions")
    .select("id,identity_id,subscription")
    .eq("tenant_id", tenantId)
    .eq("state", "active")
    .in("identity_id", identityIds);
  if (subscriptionError) {
    throw new Error(`Unable to load push subscriptions: ${subscriptionError.message}`);
  }
  summary.subscriptions = subscriptions?.length ?? 0;

  const payload = object(event.payload);
  const notification = JSON.stringify({
    title: localized(payload.title, "Student arrived"),
    body: localized(payload.body, "Your child has arrived."),
    link: text(payload.link) || "/portal",
    tag: `attendance-arrival-${attendanceEventId}`
  });
  for (const row of subscriptions ?? []) {
    const subscriptionId = number(row.id);
    const subscription = validSubscription(row.subscription);
    if (!subscriptionId || !subscription) {
      summary.skipped += 1;
      continue;
    }

    const { data: reservation, error: reserveError } = await admin.rpc(
      "reserve_portal_push_delivery_v1",
      {
        p_tenant_id: tenantId,
        p_event_id: eventId,
        p_subscription_id: subscriptionId
      }
    );
    if (reserveError) {
      summary.failed += 1;
      continue;
    }
    const reserved = object(reservation);
    if (reserved.reserved !== true) {
      summary.skipped += 1;
      continue;
    }
    const deliveryId = number(reserved.delivery_id);
    if (!deliveryId) {
      summary.failed += 1;
      continue;
    }
    summary.attempted += 1;

    try {
      const result = await webpush.sendNotification(subscription, notification, {
        TTL: 3600,
        urgency: "high"
      });
      await admin.rpc("finish_portal_push_delivery_v1", {
        p_tenant_id: tenantId,
        p_delivery_id: deliveryId,
        p_success: true,
        p_status_code: result.statusCode ?? 201,
        p_error: null
      });
      summary.delivered += 1;
    } catch (error) {
      const failure = error as PushFailure;
      const statusCode = Number.isInteger(failure.statusCode) ? failure.statusCode ?? null : null;
      await admin.rpc("finish_portal_push_delivery_v1", {
        p_tenant_id: tenantId,
        p_delivery_id: deliveryId,
        p_success: false,
        p_status_code: statusCode,
        p_error: failure.message || failure.body || "push_failed"
      });
      if (statusCode === 404 || statusCode === 410) {
        await admin
          .from("portal_push_subscriptions")
          .update({
            state: "revoked",
            revoked_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("tenant_id", tenantId)
          .eq("id", subscriptionId);
      }
      summary.failed += 1;
    }
  }

  return summary;
}

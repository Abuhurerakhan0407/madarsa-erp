import { NextResponse } from "next/server";
import {
  parseRazorpaySubscriptionWebhook,
  readBoundedRawBody,
  sha256Hex,
  verifyRazorpayWebhookSignature
} from "@/lib/billing/razorpay-webhook";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function configuredSecret(): string | null {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  return secret || null;
}

export async function POST(request: Request) {
  const secret = configuredSecret();
  if (!secret) {
    return NextResponse.json({ error: "Webhook endpoint is not configured." }, { status: 503 });
  }

  const contentType = request.headers.get("content-type")?.toLowerCase().split(";")[0].trim();
  if (contentType !== "application/json") {
    return NextResponse.json({ error: "JSON webhook required." }, { status: 415 });
  }

  const raw = await readBoundedRawBody(request);
  if (!raw.ok) {
    return NextResponse.json({ error: raw.error }, { status: raw.status });
  }

  const signature = request.headers.get("x-razorpay-signature")?.trim();
  if (!signature || !verifyRazorpayWebhookSignature(raw.bytes, signature, secret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  const providerEventId = request.headers.get("x-razorpay-event-id")?.trim();
  if (!providerEventId || providerEventId.length < 8 || providerEventId.length > 200) {
    return NextResponse.json({ error: "Invalid webhook event id." }, { status: 400 });
  }

  const parsed = parseRazorpaySubscriptionWebhook(raw.bytes);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_subscription_provider_event_v1", {
    p_provider: "razorpay",
    p_provider_event_id: providerEventId,
    p_event_type: parsed.eventType,
    p_provider_occurred_at: parsed.providerOccurredAt,
    p_provider_subscription_id: parsed.providerSubscriptionId,
    p_payload_digest: sha256Hex(raw.bytes)
  });

  if (error) {
    return NextResponse.json({ error: "Unable to record webhook event." }, { status: 500 });
  }

  const result = data as {
    processing_state?: string;
    duplicate?: boolean;
  } | null;

  return NextResponse.json(
    {
      received: true,
      state: result?.processing_state ?? "received",
      duplicate: result?.duplicate === true
    },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}

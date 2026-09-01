import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseRazorpaySubscriptionWebhook,
  readBoundedRawBody,
  sha256Hex,
  verifyRazorpayWebhookSignature
} from "./razorpay-webhook";

const encoder = new TextEncoder();

function sampleBody() {
  return JSON.stringify({
    entity: "event",
    event: "subscription.activated",
    payload: {
      subscription: {
        entity: {
          id: "sub_demo_123",
          entity: "subscription",
          status: "active"
        }
      }
    },
    created_at: 1_787_000_000
  });
}

describe("Razorpay webhook primitives", () => {
  it("verifies HMAC SHA256 against the exact raw body", () => {
    const secret = "test-webhook-secret";
    const raw = encoder.encode(sampleBody());
    const signature = createHmac("sha256", secret).update(raw).digest("hex");

    expect(verifyRazorpayWebhookSignature(raw, signature, secret)).toBe(true);
    expect(verifyRazorpayWebhookSignature(encoder.encode(sampleBody() + " "), signature, secret)).toBe(false);
    expect(verifyRazorpayWebhookSignature(raw, "not-a-signature", secret)).toBe(false);
  });

  it("parses provider event metadata without trusting tenant identity", () => {
    const raw = encoder.encode(sampleBody());
    expect(parseRazorpaySubscriptionWebhook(raw)).toEqual({
      eventType: "subscription.activated",
      providerOccurredAt: new Date(1_787_000_000 * 1000).toISOString(),
      providerSubscriptionId: "sub_demo_123"
    });
  });

  it("rejects malformed payloads and never requires a tenant id from the payload", () => {
    expect(parseRazorpaySubscriptionWebhook(encoder.encode("not json"))).toBeNull();
    expect(
      parseRazorpaySubscriptionWebhook(
        encoder.encode(JSON.stringify({ event: "subscription.activated", created_at: 1_787_000_000 }))
      )
    ).toEqual({
      eventType: "subscription.activated",
      providerOccurredAt: new Date(1_787_000_000 * 1000).toISOString(),
      providerSubscriptionId: null
    });
  });

  it("reads the untouched body with a strict byte cap", async () => {
    const request = new Request("https://example.test/webhook", {
      method: "POST",
      body: "123456",
      headers: { "content-type": "application/json" }
    });
    const result = await readBoundedRawBody(request, 6);
    expect(result.ok).toBe(true);
    if (result.ok) expect(Buffer.from(result.bytes).toString("utf8")).toBe("123456");

    const oversized = new Request("https://example.test/webhook", {
      method: "POST",
      body: "1234567",
      headers: { "content-type": "application/json" }
    });
    expect(await readBoundedRawBody(oversized, 6)).toEqual({
      ok: false,
      status: 413,
      error: "Request body is too large."
    });
  });

  it("creates a stable payload digest without retaining the payload", () => {
    const raw = encoder.encode(sampleBody());
    expect(sha256Hex(raw)).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex(raw)).toBe(sha256Hex(raw));
  });
});

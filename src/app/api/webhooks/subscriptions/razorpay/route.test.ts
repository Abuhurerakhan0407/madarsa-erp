import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn()
}));

vi.mock("../../../../../lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc })
}));

import { POST } from "./route";

const secret = "route-test-webhook-secret";

function body(event = "subscription.activated") {
  return JSON.stringify({
    entity: "event",
    event,
    payload: { subscription: { entity: { id: "sub_test_001" } } },
    created_at: 1_787_000_000
  });
}

function signature(value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function request(value: string, headers: Record<string, string> = {}) {
  return new Request("https://erp.example.test/api/webhooks/subscriptions/razorpay", {
    method: "POST",
    body: value,
    headers: {
      "content-type": "application/json",
      "x-razorpay-event-id": "event_test_001",
      "x-razorpay-signature": signature(value),
      ...headers
    }
  });
}

describe("Razorpay subscription webhook route", () => {
  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({
      data: { processing_state: "received", duplicate: false, integrity_conflict: false },
      error: null
    });
  });

  afterEach(() => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  it("fails closed when the server secret is not configured", async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const response = await POST(request(body()));
    expect(response.status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a missing or invalid signature before touching the database", async () => {
    const response = await POST(request(body(), { "x-razorpay-signature": "bad" }));
    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires a stable provider event id for idempotency", async () => {
    const response = await POST(request(body(), { "x-razorpay-event-id": "" }));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("accepts a correctly signed raw event and passes only normalized metadata to the RPC", async () => {
    const value = body();
    const response = await POST(request(value));
    const json = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(json).toEqual({
      received: true,
      state: "received",
      duplicate: false,
      integrityConflict: false
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "record_subscription_provider_event_v1",
      expect.objectContaining({
        p_provider: "razorpay",
        p_provider_event_id: "event_test_001",
        p_event_type: "subscription.activated",
        p_provider_subscription_id: "sub_test_001",
        p_payload_digest: expect.stringMatching(/^[0-9a-f]{64}$/)
      })
    );

    const rpcPayload = mocks.rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(rpcPayload).not.toHaveProperty("payload");
    expect(rpcPayload).not.toHaveProperty("tenant_id");
  });

  it("acknowledges a recorded conflicting event id as quarantined", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { processing_state: "quarantined", duplicate: true, integrity_conflict: true },
      error: null
    });

    const response = await POST(request(body()));
    const json = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(json).toEqual({
      received: true,
      state: "quarantined",
      duplicate: true,
      integrityConflict: true
    });
  });

  it("rejects oversized payloads", async () => {
    const value = "x".repeat(262_145);
    const response = await POST(
      new Request("https://erp.example.test/api/webhooks/subscriptions/razorpay", {
        method: "POST",
        body: value,
        headers: {
          "content-type": "application/json",
          "content-length": String(value.length),
          "x-razorpay-event-id": "event_test_002",
          "x-razorpay-signature": "0".repeat(64)
        }
      })
    );
    expect(response.status).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

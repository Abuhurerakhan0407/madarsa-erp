import { expect, test } from "@playwright/test";

test("subscription webhook fails closed when provider secret is not configured", async ({ request }) => {
  const response = await request.post("/api/webhooks/subscriptions/razorpay", {
    headers: {
      "content-type": "application/json",
      "x-razorpay-event-id": "event_e2e_001",
      "x-razorpay-signature": "0".repeat(64)
    },
    data: {
      entity: "event",
      event: "subscription.activated",
      payload: { subscription: { entity: { id: "sub_e2e_001" } } },
      created_at: 1_787_000_000
    }
  });

  expect(response.status()).toBe(503);
  await expect(response.json()).resolves.toEqual({ error: "Webhook endpoint is not configured." });
});

# Razorpay production verification

This procedure defines the evidence required before `payment_webhooks_verified` can be set to `true`.

## Current boundary

The governed webhook runtime is deployed at:

`POST https://madarsa-erp.vercel.app/api/webhooks/subscriptions/razorpay`

The route fails closed when `RAZORPAY_WEBHOOK_SECRET` is absent, verifies `X-Razorpay-Signature` over the untouched raw body, requires `x-razorpay-event-id`, bounds request size, and only then records normalized provider metadata through `record_subscription_provider_event_v1`.

Synthetic HMAC or direct RPC tests are not sufficient to close the commercial gate.

## Pre-activation checks

1. Confirm GitHub `main` and Vercel production are on the same tested SHA.
2. Confirm the production route exists.
3. Confirm `RAZORPAY_WEBHOOK_SECRET` is not committed to GitHub.
4. Before configuring the secret, send a production POST smoke request with JSON body. Expected result: HTTP `503` with `Webhook endpoint is not configured.` This proves the deployed route fails closed when the server secret is absent.
5. Do not persist synthetic subscription/payment rows merely to satisfy the gate.

## Real provider setup

User-controlled/provider actions:

1. Create or select the real Razorpay account used for Madarsa ERP billing.
2. Generate a dedicated webhook secret.
3. Add that exact value to Vercel production as `RAZORPAY_WEBHOOK_SECRET`.
4. Configure Razorpay webhook URL to the production endpoint above.
5. Subscribe only to the supported subscription event types implemented by the repository.
6. Ensure the endpoint is HTTPS and production is current before sending provider traffic.

Never paste the webhook secret into chat, issues, PR comments, logs, screenshots, or test fixtures.

## End-to-end proof

A valid verification run requires a webhook event delivered by Razorpay itself.

Capture:

- Razorpay event ID;
- event type;
- provider delivery timestamp;
- HTTP response status from Madarsa ERP;
- matching `subscription_provider_events` row;
- processing state;
- provider subscription ID when present;
- evidence that only the digest/normalized metadata was persisted and the raw payload was not stored.

Then replay the same provider event ID, or use Razorpay's provider retry for the same delivery when available. Verify idempotency: the event is not processed twice and the existing record is returned as duplicate.

## Negative checks

After the real secret is configured:

- missing/invalid signature -> HTTP `401`;
- unsupported content type -> HTTP `415`;
- invalid/missing provider event ID -> HTTP `400`;
- oversized body -> HTTP `413`;
- unknown subscription -> quarantined, not silently activated;
- unsupported subscription event -> quarantined;
- stale event -> ignored according to runtime rules.

## Gate closure

Set `payment_webhooks_verified=true` only when all of these are true:

1. Real Razorpay account/provider configuration exists.
2. Real production webhook secret is configured securely.
3. Razorpay is configured with the canonical production endpoint.
4. At least one real Razorpay-delivered supported event reaches production.
5. Database evidence matches that event.
6. Idempotency is verified.
7. No raw secret or raw webhook payload is persisted in application evidence.
8. Production remains on the exact tested SHA.

Until then, the gate remains false.

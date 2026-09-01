import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const RAZORPAY_WEBHOOK_MAX_BYTES = 262_144;

export type ParsedRazorpaySubscriptionWebhook = {
  eventType: string;
  providerOccurredAt: string;
  providerSubscriptionId: string | null;
};

export type RawBodyResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; status: 400 | 413; error: string };

export async function readBoundedRawBody(
  request: Request,
  maxBytes = RAZORPAY_WEBHOOK_MAX_BYTES
): Promise<RawBodyResult> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, status: 413, error: "Request body is too large." };
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: false, status: 400, error: "Webhook body is required." };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;

      total += chunk.value.byteLength;
      if (total > maxBytes) {
        void reader.cancel().catch(() => {});
        return { ok: false, status: 413, error: "Request body is too large." };
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }

  if (total === 0) {
    return { ok: false, status: 400, error: "Webhook body is required." };
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, bytes: body };
}

export function verifyRazorpayWebhookSignature(
  rawBody: Uint8Array,
  signature: string,
  secret: string
): boolean {
  const supplied = signature.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(supplied) || !secret) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(expected, "hex"));
}

export function sha256Hex(rawBody: Uint8Array): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export function parseRazorpaySubscriptionWebhook(
  rawBody: Uint8Array
): ParsedRazorpaySubscriptionWebhook | null {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(rawBody).toString("utf8")) as unknown;
  } catch {
    return null;
  }

  if (!value || typeof value !== "object") return null;
  const envelope = value as Record<string, unknown>;
  if (typeof envelope.event !== "string" || envelope.event.length < 4) return null;

  const createdAt = envelope.created_at;
  if (typeof createdAt !== "number" || !Number.isFinite(createdAt) || createdAt <= 0) return null;

  const payload = envelope.payload;
  let providerSubscriptionId: string | null = null;
  if (payload && typeof payload === "object") {
    const subscription = (payload as Record<string, unknown>).subscription;
    if (subscription && typeof subscription === "object") {
      const entity = (subscription as Record<string, unknown>).entity;
      if (entity && typeof entity === "object") {
        const id = (entity as Record<string, unknown>).id;
        if (typeof id === "string" && id.trim()) providerSubscriptionId = id.trim();
      }
    }
  }

  const occurred = new Date(createdAt * 1000);
  if (Number.isNaN(occurred.getTime())) return null;

  return {
    eventType: envelope.event,
    providerOccurredAt: occurred.toISOString(),
    providerSubscriptionId
  };
}

export type PublicAdmissionTrackingInput = {
  trackingId: string;
  trackingToken: string;
};

const trackingIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validatePublicAdmissionTrackingInput(body: unknown): {
  value?: PublicAdmissionTrackingInput;
  errors: string[];
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: ["Request body must be an object."] };
  }

  const input = body as Record<string, unknown>;
  const trackingId = typeof input.trackingId === "string" ? input.trackingId.trim() : "";
  const trackingToken = typeof input.trackingToken === "string" ? input.trackingToken.trim() : "";
  const errors: string[] = [];

  if (!trackingIdPattern.test(trackingId)) {
    errors.push("Tracking reference is invalid.");
  }
  if (trackingToken.length < 32 || trackingToken.length > 128) {
    errors.push("Private tracking key is invalid.");
  }

  if (errors.length > 0) return { errors };
  return { errors: [], value: { trackingId, trackingToken } };
}

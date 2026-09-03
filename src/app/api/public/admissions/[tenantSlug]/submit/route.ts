import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getPublicAdmissionsContext } from "@/lib/admissions/public-intake-context";
import { validatePublicAdmissionSubmission } from "@/lib/admissions/public-intake-model";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ tenantSlug: string }>;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function requestSource(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (forwarded) return forwarded;
  if (realIp) return realIp;
  return `unknown:${request.headers.get("user-agent")?.slice(0, 160) ?? "agent"}`;
}

export async function POST(request: Request, { params }: RouteContext) {
  const origin = request.headers.get("origin");
  if (!origin || !isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin submission blocked." }, { status: 403 });
  }

  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  }

  const { tenantSlug } = await params;
  const body = await readBoundedJson(request);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  let intake;
  try {
    intake = await getPublicAdmissionsContext(tenantSlug);
  } catch {
    return NextResponse.json({ error: "Admissions are temporarily unavailable." }, { status: 503 });
  }

  if (!intake) {
    return NextResponse.json({ error: "Admissions are not available for this institution." }, { status: 404 });
  }

  const validation = validatePublicAdmissionSubmission(body.value, intake.form.sections);
  if (!validation.value) {
    return NextResponse.json({ error: "Please correct the application.", details: validation.errors }, { status: 400 });
  }

  const input = body.value && typeof body.value === "object" && !Array.isArray(body.value)
    ? body.value as Record<string, unknown>
    : {};
  const photoToken = typeof input.photoToken === "string" ? input.photoToken.trim() : "";
  const requiresPhoto = intake.tenant.clientProfile === "client-v2";
  if (requiresPhoto && !/^[A-Za-z0-9_-]{40,80}$/.test(photoToken)) {
    return NextResponse.json({ error: "A valid student photo is required." }, { status: 400 });
  }

  const trackingToken = randomBytes(32).toString("base64url");
  const trackingSecretHash = sha256(trackingToken);
  const sourceHash = sha256(`${tenantSlug}|${requestSource(request)}`);
  const admin = createAdminClient();
  const rpcArgs: Record<string, unknown> = {
    p_tenant_slug: tenantSlug,
    p_session_key: validation.value.sessionKey,
    p_program_key: validation.value.programKey,
    p_preferred_locale: validation.value.preferredLocale,
    p_answers: validation.value.answers,
    p_consent: validation.value.consent,
    p_tracking_secret_hash: trackingSecretHash,
    p_source_hash: sourceHash
  };
  if (requiresPhoto) rpcArgs.p_photo_token_digest = sha256(photoToken);

  const { data, error } = await admin.rpc(
    requiresPhoto ? "submit_public_admission_v2" : "submit_public_admission",
    rpcArgs
  );

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("student photo")) {
      return NextResponse.json({ error: "Student photo expired or is no longer valid. Please select it again." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to submit the application." }, { status: 500 });
  }

  const result = data as {
    rate_limited?: boolean;
    tracking_id?: string;
    state?: string;
  } | null;

  if (result?.rate_limited) {
    return NextResponse.json(
      { error: "Too many submissions. Please wait before trying again." },
      { status: 429, headers: { "retry-after": "900" } }
    );
  }

  if (!result?.tracking_id) {
    return NextResponse.json({ error: "Application submission did not complete." }, { status: 500 });
  }

  return NextResponse.json(
    {
      trackingId: result.tracking_id,
      trackingToken,
      state: result.state ?? "submitted"
    },
    {
      status: 201,
      headers: { "cache-control": "no-store" }
    }
  );
}

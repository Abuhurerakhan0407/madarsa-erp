import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { validatePublicAdmissionTrackingInput } from "@/lib/admissions/tracking-model";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin tracking blocked." }, { status: 403 });
  }

  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return NextResponse.json({ error: "Tracking request is too large." }, { status: 413 });
  }

  const parsedBody = await readBoundedJson(request, 4_096);
  if (!parsedBody.ok) {
    const error = parsedBody.status === 413 ? "Tracking request is too large." : parsedBody.error;
    return NextResponse.json({ error }, { status: parsedBody.status });
  }
  const body = parsedBody.value;

  const validation = validatePublicAdmissionTrackingInput(body);
  if (!validation.value) {
    return NextResponse.json(
      { error: "Tracking details are invalid.", details: validation.errors },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("track_public_admission", {
    p_tracking_id: validation.value.trackingId,
    p_tracking_secret_hash: sha256(validation.value.trackingToken),
    p_source_hash: sha256(`admission-track|${requestSource(request)}`)
  });

  if (error) {
    return NextResponse.json({ error: "Tracking is temporarily unavailable." }, { status: 503 });
  }

  const result = data as {
    matched?: boolean;
    rate_limited?: boolean;
    state?: string;
    submitted_at?: string;
    tenant_name?: string;
    program_labels?: Record<string, string>;
    session_labels?: Record<string, string>;
  } | null;

  if (result?.rate_limited) {
    return NextResponse.json(
      { error: "Too many tracking attempts. Please wait before trying again." },
      { status: 429, headers: { "retry-after": "900", "cache-control": "no-store" } }
    );
  }

  if (!result?.matched) {
    return NextResponse.json(
      { error: "Tracking details were not found." },
      { status: 404, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      state: result.state,
      submittedAt: result.submitted_at,
      tenantName: result.tenant_name,
      programLabels: result.program_labels,
      sessionLabels: result.session_labels
    },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}

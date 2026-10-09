import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  checkParentLoginRateLimit,
  isPortalEmailLogin,
  recordParentLoginFailure,
  resolvePortalLoginEmail,
} from "@/lib/portal/parent-login-server";
import { normalizeLoginIdentifier } from "@/lib/portal/parent-login";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";

const INVALID_CREDENTIALS = "invalid_credentials";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 403 });
  }
  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 415 });
  }

  const parsed = await readBoundedJson(request, 8192);
  if (!parsed.ok) {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 400 });
  }

  const body = parsed.value && typeof parsed.value === "object" && !Array.isArray(parsed.value)
    ? parsed.value as Record<string, unknown>
    : {};
  const identifier = normalizeLoginIdentifier(body.identifier);
  const password = typeof body.password === "string" ? body.password : "";

  const usernameForLimit = identifier.kind === "email"
    ? identifier.email
    : typeof body.identifier === "string" ? body.identifier.trim().toLowerCase().slice(0, 128) : null;

  const rateLimit = await checkParentLoginRateLimit(request, usernameForLimit);
  if (rateLimit.infrastructureError) {
    return NextResponse.json(
      { error: "auth_service_unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          "cache-control": "no-store",
          "Retry-After": String(Math.max(1, rateLimit.retryAfterSeconds || 600)),
        },
      }
    );
  }

  if (identifier.kind === "invalid" || !password) {
    const recorded = await recordParentLoginFailure(request, usernameForLimit);
    if (recorded.infrastructureError) {
      return NextResponse.json(
        { error: "auth_service_unavailable" },
        { status: 503, headers: { "cache-control": "no-store" } }
      );
    }
    return NextResponse.json(
      { error: recorded.allowed ? INVALID_CREDENTIALS : "rate_limited" },
      {
        status: recorded.allowed ? 401 : 429,
        headers: {
          "cache-control": "no-store",
          ...(recorded.allowed ? {} : { "Retry-After": String(Math.max(1, recorded.retryAfterSeconds || 600)) }),
        },
      }
    );
  }

  if (identifier.kind === "email") {
    try {
      if (await isPortalEmailLogin(identifier.email)) {
        return NextResponse.json(
          { error: INVALID_CREDENTIALS },
          { status: 401, headers: { "cache-control": "no-store" } }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "auth_service_unavailable" },
        { status: 503, headers: { "cache-control": "no-store" } }
      );
    }
  }

  let authEmail = identifier.email;
  if (identifier.kind === "username") {
    try {
      authEmail = await resolvePortalLoginEmail(identifier.username);
    } catch {
      return NextResponse.json(
        { error: "auth_service_unavailable" },
        { status: 503, headers: { "cache-control": "no-store" } }
      );
    }

    if (!authEmail) {
      const recorded = await recordParentLoginFailure(request, usernameForLimit);
      if (recorded.infrastructureError) {
        return NextResponse.json(
          { error: "auth_service_unavailable" },
          { status: 503, headers: { "cache-control": "no-store" } }
        );
      }
      return NextResponse.json(
        { error: recorded.allowed ? INVALID_CREDENTIALS : "rate_limited" },
        {
          status: recorded.allowed ? 401 : 429,
          headers: {
            "cache-control": "no-store",
            ...(recorded.allowed ? {} : { "Retry-After": String(Math.max(1, recorded.retryAfterSeconds || 600)) }),
          },
        }
      );
    }
  }

  if (!authEmail) {
    const recorded = await recordParentLoginFailure(request, usernameForLimit);
    if (recorded.infrastructureError) {
      return NextResponse.json(
        { error: "auth_service_unavailable" },
        { status: 503, headers: { "cache-control": "no-store" } }
      );
    }
    return NextResponse.json(
      { error: recorded.allowed ? INVALID_CREDENTIALS : "rate_limited" },
      {
        status: recorded.allowed ? 401 : 429,
        headers: {
          "cache-control": "no-store",
          ...(recorded.allowed ? {} : { "Retry-After": String(Math.max(1, recorded.retryAfterSeconds || 600)) }),
        },
      }
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password
  });

  if (error) {
    if (error.status === 429) {
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { "cache-control": "no-store", "Retry-After": "600" } }
      );
    }
    if (error.status == null || error.status >= 500) {
      return NextResponse.json(
        { error: "auth_service_unavailable" },
        { status: 503, headers: { "cache-control": "no-store" } }
      );
    }
    const recorded = await recordParentLoginFailure(request, usernameForLimit);
    if (recorded.infrastructureError) {
      return NextResponse.json(
        { error: "auth_service_unavailable" },
        { status: 503, headers: { "cache-control": "no-store" } }
      );
    }
    return NextResponse.json(
      { error: recorded.allowed ? INVALID_CREDENTIALS : "rate_limited" },
      {
        status: recorded.allowed ? 401 : 429,
        headers: {
          "cache-control": "no-store",
          ...(recorded.allowed ? {} : { "Retry-After": String(Math.max(1, recorded.retryAfterSeconds || 600)) }),
        },
      }
    );
  }

  return NextResponse.json(
    { signedIn: true },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}

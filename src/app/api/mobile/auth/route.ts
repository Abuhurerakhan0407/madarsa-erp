import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";
import { normalizeLoginIdentifier } from "@/lib/portal/parent-login";


const NATIVE_ORIGINS = new Set(["https://localhost", "capacitor://localhost"]);

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (!origin || !NATIVE_ORIGINS.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(request: NextRequest, body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  const cors = corsHeaders(request);
  if (cors) {
    for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
  }
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}

export function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (!NATIVE_ORIGINS.has(origin)) {
    return new NextResponse(null, { status: 403, headers: { Vary: "Origin" } });
  }
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request) ?? undefined,
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !NATIVE_ORIGINS.has(origin) && origin !== request.nextUrl.origin) {
    return json(request, { error: "origin_not_allowed" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(request, { error: "invalid_json" }, { status: 400 });
  }

  const body = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};

  const rawIdentifier = typeof body.identifier === "string"
    ? body.identifier
    : typeof body.email === "string" ? body.email : "";
  const identifier = normalizeLoginIdentifier(rawIdentifier);
  const password = typeof body.password === "string" ? body.password : "";

  if (identifier.kind === "invalid" || !password) {
    return json(request, { error: "invalid_credentials" }, { status: 401 });
  }

  const { url, publishableKey } = getSupabasePublicEnv();
  const supabase = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email: identifier.email, password });

  if (error || !data.session || !data.user) {
    if (error?.status === 429) {
      return json(request, { error: "rate_limited" }, {
        status: 429,
        headers: { "Retry-After": "600" },
      });
    }
    if (error && (error.status == null || error.status >= 500)) {
      return json(request, { error: "auth_service_unavailable" }, { status: 503 });
    }
    return json(request, { error: "invalid_credentials" }, { status: 401 });
  }

  return json(request, {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    token_type: data.session.token_type,
    expires_in: data.session.expires_in,
    expires_at: data.session.expires_at,
    user: data.user,
  });
}

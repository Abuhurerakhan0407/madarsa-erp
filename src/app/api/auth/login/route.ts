import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumeParentLoginRateLimit } from "@/lib/portal/parent-login-server";
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
    ? null
    : typeof body.identifier === "string" ? body.identifier.trim().toLowerCase().slice(0, 128) : null;

  if (!(await consumeParentLoginRateLimit(request, usernameForLimit))) {
    return NextResponse.json(
      { error: INVALID_CREDENTIALS },
      { status: 429, headers: { "cache-control": "no-store" } }
    );
  }

  if (identifier.kind === "invalid" || !password) {
    return NextResponse.json(
      { error: INVALID_CREDENTIALS },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: identifier.email,
    password
  });

  if (error) {
    return NextResponse.json(
      { error: INVALID_CREDENTIALS },
      { status: error.status === 429 ? 429 : 401, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    { signedIn: true },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}

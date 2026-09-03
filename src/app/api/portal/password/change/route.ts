import { NextResponse } from "next/server";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";

function validPassword(value: string): boolean {
  return value.length >= 12
    && value.length <= 128
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /[0-9]/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  }
  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  }

  const identity = await getVerifiedIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await readBoundedJson(request);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
  const input = body.value && typeof body.value === "object" && !Array.isArray(body.value)
    ? body.value as Record<string, unknown>
    : {};
  const password = typeof input.password === "string" ? input.password : "";
  if (!validPassword(password)) {
    return NextResponse.json(
      { error: "Use 12–128 characters with uppercase, lowercase, number, and symbol." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const current = await admin.auth.admin.getUserById(identity.id);
  if (current.error || !current.data.user) {
    return NextResponse.json({ error: "Unable to load portal account." }, { status: 500 });
  }
  if (current.data.user.user_metadata?.must_change_password !== true) {
    return NextResponse.json({ error: "A mandatory password change is not pending." }, { status: 409 });
  }

  const updated = await admin.auth.admin.updateUserById(identity.id, {
    password,
    user_metadata: {
      ...current.data.user.user_metadata,
      must_change_password: false,
      password_changed_at: new Date().toISOString()
    }
  });
  if (updated.error) {
    return NextResponse.json({ error: "Unable to change password." }, { status: 500 });
  }

  return NextResponse.json(
    { changed: true },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}

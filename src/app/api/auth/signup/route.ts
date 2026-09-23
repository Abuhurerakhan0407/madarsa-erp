import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";

function validEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 320) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function validPassword(value: unknown) {
  if (typeof value !== "string") return null;
  if (value.length < 8 || value.length > 256) return null;
  return value;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin signup blocked." }, { status: 403 });
  }
  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  }

  const body = await readBoundedJson(request, 8_192);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const input =
    body.value && typeof body.value === "object" && !Array.isArray(body.value)
      ? (body.value as Record<string, unknown>)
      : {};

  const email = validEmail(input.email);
  const password = validPassword(input.password);

  if (!email || !password) {
    return NextResponse.json(
      { error: "A valid email and password of at least 8 characters are required." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in instead." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Unable to create account." }, { status: 400 });
  }

  if (!data.user) {
    return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
  }

  return NextResponse.json(
    { created: true },
    { status: 201, headers: { "cache-control": "no-store" } }
  );
}

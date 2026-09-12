import { NextResponse } from "next/server";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

const SUPPORTED_LOCALES = new Set(["en", "ur", "ar"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function mapRuntimeError(message: string): { status: number; error: string } {
  const normalized = message.toLowerCase();
  if (normalized.includes("permission denied")) {
    return { status: 403, error: "Institution settings permission required." };
  }
  if (normalized.includes("institution profile is required")) {
    return { status: 409, error: "Institution profile is not ready yet." };
  }
  if (
    normalized.includes("invalid") ||
    normalized.includes("required") ||
    normalized.includes("must be") ||
    normalized.includes("between") ||
    normalized.includes("included in supported locales")
  ) {
    return { status: 400, error: message };
  }
  return { status: 500, error: "Unable to update institution details." };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  }
  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  }

  const parsed = await readBoundedJson(request, 16_384);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  if (!isRecord(parsed.value)) {
    return NextResponse.json({ error: "Institution details are invalid." }, { status: 400 });
  }

  const displayName = text(parsed.value.displayName);
  const timezone = text(parsed.value.timezone);
  const primaryLocale = text(parsed.value.primaryLocale)?.toLowerCase() ?? null;
  const legalName = parsed.value.legalName == null ? null : text(parsed.value.legalName);
  const supportedLocales = Array.isArray(parsed.value.supportedLocales)
    ? parsed.value.supportedLocales.map((value) => text(value)?.toLowerCase() ?? "")
    : [];
  const address = parsed.value.address == null
    ? null
    : isRecord(parsed.value.address)
      ? parsed.value.address
      : undefined;

  if (!displayName || displayName.length < 2 || displayName.length > 160) {
    return NextResponse.json({ error: "Institution name must be between 2 and 160 characters." }, { status: 400 });
  }
  if (!timezone || timezone.length > 64) {
    return NextResponse.json({ error: "Timezone is invalid." }, { status: 400 });
  }
  if (!primaryLocale || !SUPPORTED_LOCALES.has(primaryLocale)) {
    return NextResponse.json({ error: "Primary locale is invalid." }, { status: 400 });
  }
  if (
    supportedLocales.length < 1 ||
    supportedLocales.length > 3 ||
    new Set(supportedLocales).size !== supportedLocales.length ||
    supportedLocales.some((locale) => !SUPPORTED_LOCALES.has(locale)) ||
    !supportedLocales.includes(primaryLocale)
  ) {
    return NextResponse.json({ error: "Supported locales are invalid." }, { status: 400 });
  }
  if (parsed.value.legalName != null && (!legalName || legalName.length < 2 || legalName.length > 160)) {
    return NextResponse.json({ error: "Legal name must be between 2 and 160 characters." }, { status: 400 });
  }
  if (address === undefined) {
    return NextResponse.json({ error: "Address must be an object." }, { status: 400 });
  }

  const identity = await getVerifiedIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id) {
    return NextResponse.json({ error: "Active tenant membership required." }, { status: 403 });
  }
  if (!workspace.branchId) {
    return NextResponse.json({ error: "Active primary branch required." }, { status: 409 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("update_institution_profile_v1", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_display_name: displayName,
    p_timezone: timezone,
    p_primary_locale: primaryLocale,
    p_supported_locales: supportedLocales,
    p_legal_name: legalName,
    p_address: address
  });

  if (error) {
    const mapped = mapRuntimeError(error.message);
    return NextResponse.json(
      { error: mapped.error },
      { status: mapped.status, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    { result: data },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}

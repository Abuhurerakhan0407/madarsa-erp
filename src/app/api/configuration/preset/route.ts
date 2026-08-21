import { NextResponse } from "next/server";
import { getConfigurationPreset } from "@/lib/configuration/presets";
import { buildPresetDraftPayload } from "@/lib/configuration/preset-payload";
import { isJsonRequest, isSameOriginRequest } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

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

  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id) {
    return NextResponse.json({ error: "Active tenant membership required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const presetKey =
    typeof body === "object" && body !== null && "presetKey" in body
      ? (body as { presetKey?: unknown }).presetKey
      : undefined;

  if (typeof presetKey !== "string") {
    return NextResponse.json({ error: "Preset key is required." }, { status: 400 });
  }

  let preset;
  try {
    preset = getConfigurationPreset(presetKey as Parameters<typeof getConfigurationPreset>[0]);
  } catch {
    return NextResponse.json({ error: "Unknown configuration preset." }, { status: 400 });
  }

  const payload = buildPresetDraftPayload(preset);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("apply_configuration_preset_drafts", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_preset_key: preset.key,
    p_terminology: payload.terminology,
    p_attendance_statuses: payload.attendanceStatuses
  });

  if (error) {
    const denied = error.message.toLowerCase().includes("permission denied");
    return NextResponse.json(
      { error: denied ? "Configuration permission required." : "Unable to create preset drafts." },
      { status: denied ? 403 : 500 }
    );
  }

  return NextResponse.json(
    { result: data },
    {
      status: 201,
      headers: { "cache-control": "no-store" }
    }
  );
}

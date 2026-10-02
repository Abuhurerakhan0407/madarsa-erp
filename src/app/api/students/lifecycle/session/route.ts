import { NextResponse } from "next/server";
import { disabledCapabilityResponse } from "@/lib/capabilities/server";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { prepareNextAcademicSession } from "@/lib/students/lifecycle";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const parsed = await readBoundedJson(request, 16_384);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json({ error: "Active institution membership required." }, { status: 403 });
  }
  const capabilityDenied = disabledCapabilityResponse(workspace, "student_lifecycle_import_promotion_renewal");
  if (capabilityDenied) return capabilityDenied;

  try {
    const body = parsed.value as Record<string, unknown>;
    const sourceSessionId = Number(body.sourceSessionId);
    const key = typeof body.key === "string" ? body.key.trim().toLowerCase() : "";
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const ur = typeof body.labelUr === "string" ? body.labelUr.trim() : "";
    const startsOn = typeof body.startsOn === "string" ? body.startsOn : "";
    const endsOn = typeof body.endsOn === "string" ? body.endsOn : "";

    if (
      !Number.isInteger(sourceSessionId) ||
      sourceSessionId <= 0 ||
      !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(key) ||
      label.length < 2 ||
      label.length > 120 ||
      ur.length > 120 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startsOn) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endsOn) ||
      endsOn < startsOn
    ) {
      return NextResponse.json({ error: "Academic session details are invalid." }, { status: 400 });
    }

    const result = await prepareNextAcademicSession({
      sourceSessionId,
      key,
      labels: { en: label, ...(ur ? { ur } : {}) },
      startsOn,
      endsOn
    });
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare the next academic session.";
    const lower = message.toLowerCase();
    return NextResponse.json(
      { error: message },
      { status: lower.includes("permission denied") ? 403 : lower.includes("already") || lower.includes("conflict") ? 409 : 400 }
    );
  }
}

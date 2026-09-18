import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { disabledCapabilityResponse } from "@/lib/capabilities/server";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { planStudentRollover } from "@/lib/students/lifecycle";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const parsed = await readBoundedJson(request, 65_536);
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
    const targetSessionId = Number(body.targetSessionId);
    const targetGroupId = Number(body.targetGroupId);
    const mode = body.mode;
    const studentPersonIds = Array.isArray(body.studentPersonIds)
      ? [...new Set(body.studentPersonIds.map(Number).filter((value) => Number.isInteger(value) && value > 0))]
      : [];

    if (
      !Number.isInteger(targetSessionId) ||
      targetSessionId <= 0 ||
      !Number.isInteger(targetGroupId) ||
      targetGroupId <= 0 ||
      (mode !== "promotion" && mode !== "renewal") ||
      studentPersonIds.length < 1 ||
      studentPersonIds.length > 250
    ) {
      return NextResponse.json({ error: "Rollover request is invalid." }, { status: 400 });
    }

    const requestKey =
      typeof body.requestKey === "string" && body.requestKey.trim().length >= 16
        ? body.requestKey.trim().slice(0, 128)
        : `student-rollover:${randomUUID()}`;

    const result = await planStudentRollover({
      studentPersonIds,
      targetSessionId,
      targetGroupId,
      mode,
      requestKey
    });
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to plan student rollover.";
    const lower = message.toLowerCase();
    return NextResponse.json(
      { error: message },
      { status: lower.includes("permission denied") ? 403 : lower.includes("already") || lower.includes("conflict") ? 409 : 400 }
    );
  }
}

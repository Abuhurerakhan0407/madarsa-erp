import { NextResponse } from "next/server";
import { issuePortalAccess } from "@/lib/portal/runtime";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const parsed = await readBoundedJson(request, 8192);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json({ error: "Active institution membership required." }, { status: 403 });
  }

  const body = parsed.value as Record<string, unknown>;
  const personId = Number(body.personId);
  const linkType = body.linkType;
  const days = Number(body.expiresInDays ?? 7);
  if (
    !Number.isInteger(personId) ||
    personId <= 0 ||
    (linkType !== "guardian" && linkType !== "employee") ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 30
  ) {
    return NextResponse.json({ error: "Portal access request is invalid." }, { status: 400 });
  }

  try {
    const result = await issuePortalAccess({ personId, linkType, expiresInDays: days });
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to issue portal access.";
    const lower = message.toLowerCase();
    return NextResponse.json(
      { error: message },
      { status: lower.includes("permission denied") ? 403 : lower.includes("not found") ? 404 : 409 }
    );
  }
}

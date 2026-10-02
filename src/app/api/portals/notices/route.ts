import { NextResponse } from "next/server";
import { publishPortalNotice, type PortalNoticePriority } from "@/lib/portal/runtime";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const parsed = await readBoundedJson(request, 16384);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json({ error: "Active institution membership required." }, { status: 403 });
  }

  const body = parsed.value as Record<string, unknown>;
  const audienceType = body.audienceType;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const noticeBody = typeof body.body === "string" ? body.body.trim() : "";
  const priority = body.priority;
  const expiresAt = typeof body.expiresAt === "string" && body.expiresAt ? body.expiresAt : null;

  if (
    (audienceType !== "tenant" && audienceType !== "parents" && audienceType !== "employees") ||
    (priority !== undefined && priority !== "normal" && priority !== "important" && priority !== "urgent") ||
    title.length < 2 ||
    title.length > 160 ||
    noticeBody.length < 2 ||
    noticeBody.length > 4000
  ) {
    return NextResponse.json({ error: "Portal notice is invalid." }, { status: 400 });
  }

  try {
    const result = await publishPortalNotice({
      audienceType,
      title,
      body: noticeBody,
      priority: (priority ?? "normal") as PortalNoticePriority,
      expiresAt
    });
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to publish portal notice.";
    const lower = message.toLowerCase();
    return NextResponse.json(
      { error: message },
      { status: lower.includes("permission denied") ? 403 : lower.includes("not found") ? 404 : 409 }
    );
  }
}

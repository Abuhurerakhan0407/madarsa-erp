import { NextResponse } from "next/server";
import { issueStudentStatusCertificate } from "@/lib/documents/student-status";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

type Raw = Record<string, unknown>;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const body = await readBoundedJson(request, 8192);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
  }

  const value = body.value && typeof body.value === "object" && !Array.isArray(body.value) ? body.value as Raw : {};
  const personId = Number(value.personId);
  const requestKey = typeof value.requestKey === "string" ? value.requestKey.trim() : "";
  if (!Number.isInteger(personId) || personId <= 0 || requestKey.length < 16 || requestKey.length > 128) {
    return NextResponse.json({ error: "Valid student and request key are required." }, { status: 400 });
  }

  try {
    const certificate = await issueStudentStatusCertificate(personId, requestKey);
    return NextResponse.json({ certificate });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("permission denied")) return NextResponse.json({ error: "Certificate issuance permission required." }, { status: 403 });
    if (message.includes("active branch student enrollment required")) return NextResponse.json({ error: "Student is not eligible for a status certificate in this branch." }, { status: 409 });
    return NextResponse.json({ error: "Unable to issue student status certificate." }, { status: 500 });
  }
}

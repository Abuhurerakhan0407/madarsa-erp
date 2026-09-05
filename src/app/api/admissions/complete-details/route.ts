import { NextResponse } from "next/server";
import { isJsonRequest, isSameOriginRequest } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

type CompletionInput = {
  applicationId: number;
  nativeName: string;
  gender: "male" | "female" | "other" | "undisclosed";
  guardianName: string;
  guardianRelationship: "father" | "mother" | "guardian" | "other";
  guardianPhone: string;
  guardianEmail: string;
  groupKey: string;
  joiningDate: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const groupPattern = /^[a-z0-9][a-z0-9_-]{1,63}$/;

function text(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  const cleaned = value.trim();
  return cleaned.length <= max ? cleaned : "";
}

function parseInput(body: unknown): { value?: CompletionInput; error?: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Check the admission details." };
  const input = body as Record<string, unknown>;
  const applicationId = typeof input.applicationId === "number" && Number.isSafeInteger(input.applicationId) && input.applicationId > 0
    ? input.applicationId
    : 0;
  const nativeName = text(input.nativeName, 160);
  const gender = input.gender === "male" || input.gender === "female" || input.gender === "other" || input.gender === "undisclosed"
    ? input.gender
    : null;
  const guardianName = text(input.guardianName, 160);
  const guardianRelationship = input.guardianRelationship === "father" || input.guardianRelationship === "mother" || input.guardianRelationship === "guardian" || input.guardianRelationship === "other"
    ? input.guardianRelationship
    : null;
  const guardianPhone = text(input.guardianPhone, 80);
  const guardianEmail = text(input.guardianEmail, 320).toLowerCase();
  const groupKey = text(input.groupKey, 64);
  const joiningDate = text(input.joiningDate, 10);

  if (!applicationId) return { error: "Admission application is invalid." };
  if (nativeName.length < 2) return { error: "Enter the student's Urdu / Arabic name." };
  if (!gender) return { error: "Choose the student's gender." };
  if (guardianName.length < 2) return { error: "Enter the guardian name." };
  if (!guardianRelationship) return { error: "Choose the guardian relationship." };
  if (guardianPhone.length < 6) return { error: "Enter a valid guardian phone number." };
  if (!emailPattern.test(guardianEmail)) return { error: "Enter a valid guardian email address." };
  if (!groupPattern.test(groupKey)) return { error: "Choose a valid class / group." };
  if (!datePattern.test(joiningDate) || Number.isNaN(Date.parse(`${joiningDate}T00:00:00Z`))) return { error: "Choose a valid joining date." };

  return {
    value: {
      applicationId,
      nativeName,
      gender,
      guardianName,
      guardianRelationship,
      guardianPhone,
      guardianEmail,
      groupKey,
      joiningDate
    }
  };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 8192) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
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
  const parsed = parseInput(body);
  if (!parsed.value) return NextResponse.json({ error: parsed.error ?? "Check the admission details." }, { status: 400 });

  const admin = createAdminClient();
  const value = parsed.value;
  const { data, error } = await admin.rpc("complete_online_admission_details_v3", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_application_id: value.applicationId,
    p_native_name: value.nativeName,
    p_gender: value.gender,
    p_guardian_name: value.guardianName,
    p_guardian_relationship: value.guardianRelationship,
    p_guardian_phone: value.guardianPhone,
    p_guardian_email: value.guardianEmail,
    p_group_key: value.groupKey,
    p_joining_date: value.joiningDate
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("permission denied")) return NextResponse.json({ error: "Admission review permission required." }, { status: 403 });
    if (message.includes("not found")) return NextResponse.json({ error: "Admission application not found." }, { status: 404 });
    if (message.includes("can no longer") || message.includes("session") || message.includes("group") || message.includes("joining date")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (message.includes("valid")) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ error: "Unable to save the admission details." }, { status: 500 });
  }

  return NextResponse.json({ result: data }, { status: 200, headers: { "cache-control": "no-store" } });
}

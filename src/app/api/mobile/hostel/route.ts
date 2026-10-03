import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMobileStaffWorkspace } from "@/lib/mobile/server-auth";

const NATIVE_ORIGINS = new Set(["https://localhost", "capacitor://localhost"]);

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (!origin || !NATIVE_ORIGINS.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(request: NextRequest, body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  const cors = corsHeaders(request);
  if (cors) for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}

export function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (!NATIVE_ORIGINS.has(origin)) {
    return new NextResponse(null, { status: 403, headers: { Vary: "Origin" } });
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) ?? undefined });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !NATIVE_ORIGINS.has(origin) && origin !== request.nextUrl.origin) {
    return json(request, { error: "origin_not_allowed" }, { status: 403 });
  }

  const tenantId = Number.parseInt(request.nextUrl.searchParams.get("tenantId") ?? "", 10);
  const branchId = Number.parseInt(request.nextUrl.searchParams.get("branchId") ?? "", 10);
  if (!Number.isInteger(tenantId) || tenantId <= 0 ||
      !Number.isInteger(branchId) || branchId <= 0) {
    return json(request, { error: "invalid_request" }, { status: 400 });
  }

  const workspace = await resolveMobileStaffWorkspace(request, { tenantId, branchId });
  if (!workspace || !workspace.branchId) {
    return json(request, { error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_hostel_mess_center_v1", {
    p_identity_id: workspace.identityId,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
  });

  if (error) {
    console.error("mobile hostel center failed", { code: error.code });
    return json(request, { error: "hostel_unavailable" }, { status: 503 });
  }

  return json(request, {
    readOnly: true,
    workspace: {
      tenantId: workspace.tenantId,
      branchId: workspace.branchId,
      surface: workspace.surface,
    },
    center: data && typeof data === "object" ? data : {},
  });
}

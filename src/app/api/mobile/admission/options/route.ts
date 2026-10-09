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
  const [sessionsResult, programsResult, groupsResult] = await Promise.all([
    admin
      .from("academic_sessions")
      .select("id, key, labels")
      .eq("tenant_id", workspace.tenantId)
      .eq("status", "active")
      .order("starts_on", { ascending: false }),
    admin
      .from("programs")
      .select("id, key, labels, branch_id")
      .eq("tenant_id", workspace.tenantId)
      .eq("status", "active"),
    admin
      .from("academic_groups")
      .select("id, key, labels, session_id, program_id")
      .eq("tenant_id", workspace.tenantId)
      .eq("branch_id", workspace.branchId)
      .eq("status", "active"),
  ]);

  if (sessionsResult.error || programsResult.error || groupsResult.error) {
    console.error("mobile admission options failed", {
      sessions: sessionsResult.error?.code ?? null,
      programs: programsResult.error?.code ?? null,
      groups: groupsResult.error?.code ?? null,
    });
    return json(request, { error: "admission_options_unavailable" }, { status: 503 });
  }

  const programs = (programsResult.data ?? []).filter(
    (program) => program.branch_id == null || program.branch_id === workspace.branchId,
  );

  return json(request, {
    readOnly: true,
    sessions: sessionsResult.data ?? [],
    programs,
    groups: groupsResult.data ?? [],
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type MobileSurface = "admin" | "teacher" | "parent";
type MobileAccessMode = "membership" | "portal";

type Workspace = {
  tenantId: number;
  tenantName: string;
  tenantSlug: string;
  branchId: number | null;
  branchName: string | null;
  surface: MobileSurface;
  roleKeys: string[];
  accessMode: MobileAccessMode;
};

const NATIVE_ORIGINS = new Set(["https://localhost", "capacitor://localhost"]);

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function nativeCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (!origin || !NATIVE_ORIGINS.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function json(request: NextRequest, body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  const cors = nativeCorsHeaders(request);
  if (cors) for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}

function unauthorized(request: NextRequest) {
  return json(request, { error: "unauthorized" }, { status: 401 });
}

export function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (!NATIVE_ORIGINS.has(origin)) return new NextResponse(null, { status: 403, headers: { Vary: "Origin" } });
  return new NextResponse(null, { status: 204, headers: nativeCorsHeaders(request) ?? undefined });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !NATIVE_ORIGINS.has(origin) && origin !== request.nextUrl.origin) {
    return json(request, { error: "origin_not_allowed" }, { status: 403 });
  }

  const token = getBearerToken(request);
  if (!token) return unauthorized(request);

  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) return unauthorized(request);

  const now = new Date().toISOString();
  const { data: memberships, error: membershipError } = await admin
    .from("memberships")
    .select("id, tenant_id, all_branches, created_at")
    .eq("identity_id", user.id)
    .eq("status", "active")
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("created_at", { ascending: true });

  if (membershipError) {
    console.error("mobile bootstrap membership resolution failed", { code: membershipError.code });
    return json(request, { error: "workspace_unavailable" }, { status: 503 });
  }

  const workspaces: Workspace[] = [];
  const workspaceKeys = new Set<string>();
  const pushWorkspace = (workspace: Workspace) => {
    const key = `${workspace.tenantId}:${workspace.branchId ?? "tenant"}:${workspace.surface}`;
    if (workspaceKeys.has(key)) return;
    workspaces.push(workspace);
    workspaceKeys.add(key);
  };

  for (const membership of memberships ?? []) {
    const [{ data: tenant, error: tenantError }, { data: roleLinks, error: roleLinkError }] = await Promise.all([
      admin.from("tenants").select("id, name, slug, state").eq("id", membership.tenant_id).maybeSingle(),
      admin.from("membership_roles").select("role_id").eq("tenant_id", membership.tenant_id).eq("membership_id", membership.id)
    ]);
    if (tenantError || roleLinkError || !tenant || tenant.state !== "active") continue;

    const roleIds = (roleLinks ?? []).map((row) => row.role_id);
    if (!roleIds.length) continue;
    const { data: roles, error: roleError } = await admin
      .from("roles")
      .select("key")
      .eq("tenant_id", membership.tenant_id)
      .eq("status", "active")
      .in("id", roleIds);
    if (roleError) continue;

    const roleKeys = (roles ?? []).map((row) => row.key).filter(Boolean);
    const surface: MobileSurface | null = roleKeys.some((key) => key === "owner" || key === "admin" || key === "accountant")
      ? "admin"
      : roleKeys.includes("teacher")
        ? "teacher"
        : null;
    if (!surface) continue;

    let branchIds: number[] = [];
    if (membership.all_branches) {
      const { data: branches, error: branchError } = await admin
        .from("branches")
        .select("id")
        .eq("tenant_id", membership.tenant_id)
        .eq("status", "active")
        .order("id", { ascending: true });
      if (branchError) continue;
      branchIds = (branches ?? []).map((branch) => branch.id);
    } else {
      const { data: scopes, error: scopeError } = await admin
        .from("membership_branch_scopes")
        .select("branch_id")
        .eq("tenant_id", membership.tenant_id)
        .eq("membership_id", membership.id);
      if (scopeError) continue;
      branchIds = [...new Set((scopes ?? []).map((scope) => scope.branch_id))];
    }
    if (!branchIds.length) continue;

    const { data: branches, error: branchError } = await admin
      .from("branches")
      .select("id, name, status")
      .eq("tenant_id", membership.tenant_id)
      .eq("status", "active")
      .in("id", branchIds);
    if (branchError) continue;

    for (const branch of branches ?? []) {
      pushWorkspace({
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        branchId: branch.id,
        branchName: branch.name,
        surface,
        roleKeys,
        accessMode: "membership"
      });
    }
  }

  const { data: portalLinks, error: portalError } = await admin
    .from("identity_person_links")
    .select("tenant_id, person_id, link_type, status")
    .eq("identity_id", user.id)
    .eq("status", "verified")
    .in("link_type", ["guardian", "employee"]);

  if (!portalError) {
    for (const link of portalLinks ?? []) {
      const { data: tenant, error: tenantError } = await admin
        .from("tenants")
        .select("id, name, slug, state")
        .eq("id", link.tenant_id)
        .maybeSingle();
      if (tenantError || !tenant || tenant.state !== "active") continue;

      if (link.link_type === "employee") {
        const { data: employments, error: employmentError } = await admin
          .from("hr_employments")
          .select("branch_id")
          .eq("tenant_id", link.tenant_id)
          .eq("employee_person_id", link.person_id)
          .in("state", ["active", "on_leave"]);
        if (employmentError) continue;
        const branchIds = [...new Set((employments ?? []).map((employment) => employment.branch_id).filter(Boolean))];
        if (!branchIds.length) continue;
        const { data: branches, error: branchError } = await admin
          .from("branches")
          .select("id, name, status")
          .eq("tenant_id", link.tenant_id)
          .eq("status", "active")
          .in("id", branchIds);
        if (branchError) continue;
        for (const branch of branches ?? []) {
          pushWorkspace({
            tenantId: tenant.id,
            tenantName: tenant.name,
            tenantSlug: tenant.slug,
            branchId: branch.id,
            branchName: branch.name,
            surface: "teacher",
            roleKeys: ["teacher"],
            accessMode: "portal"
          });
        }
        continue;
      }

      pushWorkspace({
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        branchId: null,
        branchName: null,
        surface: "parent",
        roleKeys: [],
        accessMode: "portal"
      });
    }
  }

  const displayName = typeof user.user_metadata?.display_name === "string" && user.user_metadata.display_name.trim()
    ? user.user_metadata.display_name.trim()
    : user.email ?? "Account";

  return json(request, {
    identity: { id: user.id, email: user.email ?? null, displayName },
    workspaces
  });
}

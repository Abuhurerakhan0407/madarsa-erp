import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type MobileSurface = "admin" | "teacher" | "parent";

type Workspace = {
  tenantId: number;
  tenantName: string;
  tenantSlug: string;
  branchId: number | null;
  branchName: string | null;
  surface: MobileSurface;
  roleKeys: string[];
};

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return unauthorized();

  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) return unauthorized();

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
    console.error("mobile bootstrap membership resolution failed", {
      code: membershipError.code
    });
    return NextResponse.json({ error: "workspace_unavailable" }, { status: 503 });
  }

  const workspaces: Workspace[] = [];

  for (const membership of memberships ?? []) {
    const [{ data: tenant, error: tenantError }, { data: roleLinks, error: roleLinkError }] =
      await Promise.all([
        admin
          .from("tenants")
          .select("id, name, slug, state, primary_branch_id")
          .eq("id", membership.tenant_id)
          .maybeSingle(),
        admin
          .from("membership_roles")
          .select("role_id")
          .eq("tenant_id", membership.tenant_id)
          .eq("membership_id", membership.id)
      ]);

    if (tenantError || roleLinkError || !tenant || tenant.state !== "active") continue;

    const roleIds = (roleLinks ?? []).map((row) => row.role_id);
    let roleKeys: string[] = [];
    if (roleIds.length) {
      const { data: roles, error: roleError } = await admin
        .from("roles")
        .select("key")
        .eq("tenant_id", membership.tenant_id)
        .eq("status", "active")
        .in("id", roleIds);
      if (roleError) continue;
      roleKeys = (roles ?? []).map((row) => row.key).filter(Boolean);
    }

    let surface: MobileSurface | null = null;
    if (roleKeys.some((key) => key === "owner" || key === "admin" || key === "accountant")) {
      surface = "admin";
    } else if (roleKeys.includes("teacher")) {
      surface = "teacher";
    }
    if (!surface) continue;

    let branchId: number | null = null;
    if (membership.all_branches) {
      branchId = tenant.primary_branch_id ?? null;
    } else {
      const { data: scopes, error: scopeError } = await admin
        .from("membership_branch_scopes")
        .select("branch_id")
        .eq("tenant_id", membership.tenant_id)
        .eq("membership_id", membership.id)
        .order("created_at", { ascending: true })
        .limit(1);
      if (scopeError || !scopes?.length) continue;
      branchId = scopes[0].branch_id;
    }

    let branchName: string | null = null;
    if (branchId) {
      const { data: branch, error: branchError } = await admin
        .from("branches")
        .select("id, name, status")
        .eq("tenant_id", membership.tenant_id)
        .eq("id", branchId)
        .maybeSingle();
      if (branchError || !branch || branch.status !== "active") continue;
      branchName = branch.name;
    }

    workspaces.push({
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      branchId,
      branchName,
      surface,
      roleKeys
    });
  }

  const { data: portalLinks, error: portalError } = await admin
    .from("identity_person_links")
    .select("tenant_id, link_type, status")
    .eq("identity_id", user.id)
    .eq("status", "verified")
    .in("link_type", ["guardian", "employee"]);

  if (!portalError) {
    const existingKeys = new Set(workspaces.map((workspace) => `${workspace.tenantId}:${workspace.surface}`));
    for (const link of portalLinks ?? []) {
      const surface: MobileSurface = link.link_type === "guardian" ? "parent" : "teacher";
      const key = `${link.tenant_id}:${surface}`;
      if (existingKeys.has(key)) continue;

      const { data: tenant, error: tenantError } = await admin
        .from("tenants")
        .select("id, name, slug, state")
        .eq("id", link.tenant_id)
        .maybeSingle();
      if (tenantError || !tenant || tenant.state !== "active") continue;

      workspaces.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        branchId: null,
        branchName: null,
        surface,
        roleKeys: surface === "teacher" ? ["teacher"] : []
      });
      existingKeys.add(key);
    }
  }

  const displayName =
    typeof user.user_metadata?.display_name === "string" && user.user_metadata.display_name.trim()
      ? user.user_metadata.display_name.trim()
      : user.email ?? "Account";

  return NextResponse.json(
    {
      identity: {
        id: user.id,
        email: user.email ?? null,
        displayName
      },
      workspaces
    },
    {
      headers: {
        "Cache-Control": "no-store, private"
      }
    }
  );
}

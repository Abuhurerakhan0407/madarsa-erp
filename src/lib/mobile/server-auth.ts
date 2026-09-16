import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type MobileStaffWorkspace = {
  identityId: string;
  tenantId: number;
  branchId: number | null;
  roleKeys: string[];
  surface: "admin" | "teacher";
};

type ResolveOptions = {
  tenantId: number;
  branchId?: number | null;
};

export function getMobileBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function resolveMobileStaffWorkspace(
  request: NextRequest,
  options: ResolveOptions,
): Promise<MobileStaffWorkspace | null> {
  const token = getMobileBearerToken(request);
  if (!token || !Number.isInteger(options.tenantId) || options.tenantId <= 0) return null;

  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) return null;

  const now = new Date().toISOString();
  const { data: memberships, error: membershipError } = await admin
    .from("memberships")
    .select("id, tenant_id, all_branches")
    .eq("identity_id", user.id)
    .eq("tenant_id", options.tenantId)
    .eq("status", "active")
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .limit(1);

  const membership = memberships?.[0];
  if (membershipError || !membership) return null;

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id, state, primary_branch_id")
    .eq("id", options.tenantId)
    .maybeSingle();
  if (tenantError || !tenant || tenant.state !== "active") return null;

  const { data: roleLinks, error: roleLinkError } = await admin
    .from("membership_roles")
    .select("role_id")
    .eq("tenant_id", options.tenantId)
    .eq("membership_id", membership.id);
  if (roleLinkError) return null;

  const roleIds = (roleLinks ?? []).map((row) => row.role_id);
  if (!roleIds.length) return null;

  const { data: roles, error: roleError } = await admin
    .from("roles")
    .select("key")
    .eq("tenant_id", options.tenantId)
    .eq("status", "active")
    .in("id", roleIds);
  if (roleError) return null;

  const roleKeys = (roles ?? []).map((row) => row.key).filter(Boolean);
  const surface = roleKeys.includes("teacher") && !roleKeys.some((key) => key === "owner" || key === "admin" || key === "accountant")
    ? "teacher"
    : roleKeys.some((key) => key === "owner" || key === "admin" || key === "accountant")
      ? "admin"
      : null;
  if (!surface) return null;

  let branchId = options.branchId ?? null;
  if (membership.all_branches) {
    branchId = branchId ?? tenant.primary_branch_id ?? null;
  } else {
    const { data: scopes, error: scopeError } = await admin
      .from("membership_branch_scopes")
      .select("branch_id")
      .eq("tenant_id", options.tenantId)
      .eq("membership_id", membership.id);
    if (scopeError || !scopes?.length) return null;

    const allowedBranchIds = new Set(scopes.map((scope) => scope.branch_id));
    if (branchId == null) branchId = scopes[0].branch_id;
    if (!allowedBranchIds.has(branchId)) return null;
  }

  if (branchId != null) {
    const { data: branch, error: branchError } = await admin
      .from("branches")
      .select("id, status")
      .eq("tenant_id", options.tenantId)
      .eq("id", branchId)
      .maybeSingle();
    if (branchError || !branch || branch.status !== "active") return null;
  }

  return {
    identityId: user.id,
    tenantId: options.tenantId,
    branchId,
    roleKeys,
    surface,
  };
}

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

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id, state, primary_branch_id")
    .eq("id", options.tenantId)
    .maybeSingle();
  if (tenantError || !tenant || tenant.state !== "active") return null;

  const now = new Date().toISOString();
  const { data: memberships, error: membershipError } = await admin
    .from("memberships")
    .select("id, tenant_id, all_branches, created_at")
    .eq("identity_id", user.id)
    .eq("tenant_id", options.tenantId)
    .eq("status", "active")
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("created_at", { ascending: true });
  if (membershipError || !memberships?.length) return null;

  const requestedBranchId = options.branchId ?? null;

  for (const membership of memberships) {
    const { data: roleLinks, error: roleLinkError } = await admin
      .from("membership_roles")
      .select("role_id")
      .eq("tenant_id", options.tenantId)
      .eq("membership_id", membership.id);
    if (roleLinkError) continue;

    const roleIds = (roleLinks ?? []).map((row) => row.role_id);
    if (!roleIds.length) continue;

    const { data: roles, error: roleError } = await admin
      .from("roles")
      .select("key")
      .eq("tenant_id", options.tenantId)
      .eq("status", "active")
      .in("id", roleIds);
    if (roleError) continue;

    const roleKeys = (roles ?? []).map((row) => row.key).filter(Boolean);
    const isAdmin = roleKeys.some((key) => key === "institution_owner" || key === "owner" || key === "admin" || key === "accountant");
    const surface = isAdmin ? "admin" : roleKeys.includes("teacher") ? "teacher" : null;
    if (!surface) continue;

    let branchId: number | null = requestedBranchId;

    if (membership.all_branches) {
      if (branchId == null) {
        const primaryBranchId = tenant.primary_branch_id;
        if (typeof primaryBranchId === "number" && Number.isInteger(primaryBranchId) && primaryBranchId > 0) {
          branchId = primaryBranchId;
        } else {
          const { data: firstBranch, error: firstBranchError } = await admin
            .from("branches")
            .select("id")
            .eq("tenant_id", options.tenantId)
            .eq("status", "active")
            .order("id", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (firstBranchError || !firstBranch) continue;
          branchId = firstBranch.id;
        }
      }
    } else {
      const { data: scopes, error: scopeError } = await admin
        .from("membership_branch_scopes")
        .select("branch_id")
        .eq("tenant_id", options.tenantId)
        .eq("membership_id", membership.id)
        .order("branch_id", { ascending: true });
      if (scopeError || !scopes?.length) continue;

      const allowedBranchIds = new Set(scopes.map((scope) => scope.branch_id));
      if (branchId == null) branchId = scopes[0].branch_id;
      if (!allowedBranchIds.has(branchId)) continue;
    }

    if (branchId == null) continue;
    const { data: branch, error: branchError } = await admin
      .from("branches")
      .select("id, status")
      .eq("tenant_id", options.tenantId)
      .eq("id", branchId)
      .maybeSingle();
    if (branchError || !branch || branch.status !== "active") continue;

    return {
      identityId: user.id,
      tenantId: options.tenantId,
      branchId,
      roleKeys,
      surface,
    };
  }

  return null;
}

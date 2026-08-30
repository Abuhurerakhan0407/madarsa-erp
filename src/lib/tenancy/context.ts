import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { selectWorkspaceBranchId } from "./workspace";

export type TenantContext = {
  identityId: string;
  email?: string;
  displayName: string;
  membershipId: number;
  tenantId: number;
  tenantName: string;
  tenantSlug: string;
  tenantState: string;
  branchId: number | null;
  branchName: string | null;
  branchCode: string | null;
};

async function resolveTenantContext(): Promise<TenantContext | null> {
  const identity = await getVerifiedIdentity();
  if (!identity) return null;

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("id, tenant_id, all_branches")
    .eq("identity_id", identity.id)
    .eq("status", "active")
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(`Unable to resolve membership: ${membershipError.message}`);
  }

  if (!membership) return null;

  const [{ data: tenant, error: tenantError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase
        .from("tenants")
        .select("id, name, slug, state, primary_branch_id")
        .eq("id", membership.tenant_id)
        .single(),
      supabase
        .from("profiles")
        .select("display_name")
        .eq("identity_id", identity.id)
        .maybeSingle()
    ]);

  if (tenantError) {
    throw new Error(`Unable to resolve tenant: ${tenantError.message}`);
  }

  if (profileError) {
    throw new Error(`Unable to resolve profile: ${profileError.message}`);
  }

  let scopedBranchIds: number[] = [];
  if (!membership.all_branches) {
    const { data, error } = await supabase
      .from("membership_branch_scopes")
      .select("branch_id")
      .eq("tenant_id", tenant.id)
      .eq("membership_id", membership.id)
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw new Error(`Unable to resolve membership branch: ${error.message}`);
    scopedBranchIds = (data ?? []).map((row) => row.branch_id);
    if (scopedBranchIds.length === 0) return null;
  }

  const workspaceBranchId = selectWorkspaceBranchId(
    tenant.primary_branch_id,
    membership.all_branches,
    scopedBranchIds
  );
  let branch: { id: number; name: string; code: string } | null = null;

  if (workspaceBranchId) {
    const { data, error } = await supabase
      .from("branches")
      .select("id, name, code")
      .eq("tenant_id", tenant.id)
      .eq("id", workspaceBranchId)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to resolve primary branch: ${error.message}`);
    }

    branch = data;
  }

  return {
    identityId: identity.id,
    email: identity.email,
    displayName: profile?.display_name || identity.email || "Account",
    membershipId: membership.id,
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    tenantState: tenant.state,
    branchId: branch?.id ?? null,
    branchName: branch?.name ?? null,
    branchCode: branch?.code ?? null
  };
}

// Layouts and pages often need the same authenticated workspace in one render pass.
// React cache keeps that database work request-scoped and prevents duplicate queries.
export const getTenantContext = cache(resolveTenantContext);

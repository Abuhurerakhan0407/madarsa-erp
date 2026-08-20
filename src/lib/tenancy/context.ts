import { createClient } from "@/lib/supabase/server";
import { getVerifiedIdentity } from "@/lib/supabase/identity";

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

export async function getTenantContext(): Promise<TenantContext | null> {
  const identity = await getVerifiedIdentity();
  if (!identity) return null;

  const supabase = await createClient();
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("id, tenant_id")
    .eq("identity_id", identity.id)
    .eq("status", "active")
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

  let branch: { id: number; name: string; code: string } | null = null;

  if (tenant.primary_branch_id) {
    const { data, error } = await supabase
      .from("branches")
      .select("id, name, code")
      .eq("tenant_id", tenant.id)
      .eq("id", tenant.primary_branch_id)
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

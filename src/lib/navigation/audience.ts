import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TenantContext } from "@/lib/tenancy/context";
import type { NavigationAudience } from "./client-v3-navigation";
import { classifyNavigationAudience } from "./audience-classifier";

export { classifyNavigationAudience } from "./audience-classifier";

async function resolveNavigationAudience(
  workspace: TenantContext
): Promise<NavigationAudience> {
  const admin = createAdminClient();
  const roles = await admin
    .from("membership_roles")
    .select("role_id")
    .eq("tenant_id", workspace.tenantId)
    .eq("membership_id", workspace.membershipId);

  if (roles.error) {
    throw new Error("Unable to resolve navigation roles: " + roles.error.message);
  }

  const roleIds = (roles.data ?? [])
    .map((row) => Number(row.role_id))
    .filter(Number.isFinite);
  if (!roleIds.length) return "neutral";

  const [roleRows, permissionRows] = await Promise.all([
    admin.from("roles").select("key").eq("tenant_id", workspace.tenantId).in("id", roleIds),
    admin
      .from("role_permissions")
      .select("permission_code")
      .eq("tenant_id", workspace.tenantId)
      .in("role_id", roleIds)
  ]);

  if (roleRows.error) {
    throw new Error("Unable to resolve navigation role names: " + roleRows.error.message);
  }
  if (permissionRows.error) {
    throw new Error(
      "Unable to resolve navigation permissions: " + permissionRows.error.message
    );
  }

  const permissions = (permissionRows.data ?? []).map((row) =>
    String(row.permission_code)
  );
  if (!permissions.length) return "neutral";

  const roleKeys = (roleRows.data ?? []).map((row) => String(row.key));
  return classifyNavigationAudience(roleKeys, permissions);
}

// The layout shell and dashboard page both request the same audience.
// Request-scoped React cache prevents a duplicate role/permission query chain.
export const getNavigationAudience = cache(resolveNavigationAudience);

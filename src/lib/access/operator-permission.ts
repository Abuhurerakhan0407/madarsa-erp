import { createAdminClient } from "@/lib/supabase/admin";
import type { TenantContext } from "@/lib/tenancy/context";

export type PermissionMatchMode = "all" | "any";

export async function operatorHasPermissions(
  workspace: TenantContext,
  permissions: readonly string[],
  mode: PermissionMatchMode = "all"
): Promise<boolean> {
  if (!workspace.branchId || permissions.length === 0) return false;

  const admin = createAdminClient();
  const results = await Promise.all(
    permissions.map((permission) =>
      admin.rpc("operator_has_permission_v1", {
        p_identity_id: workspace.identityId,
        p_tenant_id: workspace.tenantId,
        p_branch_id: workspace.branchId,
        p_permission_code: permission
      })
    )
  );

  if (results.some((result) => result.error)) {
    throw new Error("Unable to verify workspace permission.");
  }

  const allowed = results.map((result) => result.data === true);
  return mode === "any" ? allowed.some(Boolean) : allowed.every(Boolean);
}

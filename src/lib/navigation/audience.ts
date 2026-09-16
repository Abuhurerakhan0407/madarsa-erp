import { createAdminClient } from "@/lib/supabase/admin";
import type { TenantContext } from "@/lib/tenancy/context";
import type { NavigationAudience } from "./client-v3-navigation";
import { classifyNavigationAudience } from "./audience-classifier";

export { classifyNavigationAudience } from "./audience-classifier";

export async function getNavigationAudience(workspace:TenantContext):Promise<NavigationAudience>{
 const admin=createAdminClient();
 const roles=await admin.from("membership_roles").select("role_id").eq("tenant_id",workspace.tenantId).eq("membership_id",workspace.membershipId);
 if(roles.error) throw new Error(`Unable to resolve navigation roles: ${roles.error.message}`);
 const roleIds=(roles.data??[]).map(row=>Number(row.role_id)).filter(Number.isFinite);
 if(!roleIds.length) return "teacher";
 const [roleRows,permissionRows]=await Promise.all([
  admin.from("roles").select("key").eq("tenant_id",workspace.tenantId).in("id",roleIds),
  admin.from("role_permissions").select("permission_code").eq("tenant_id",workspace.tenantId).in("role_id",roleIds)
 ]);
 if(roleRows.error) throw new Error(`Unable to resolve navigation role names: ${roleRows.error.message}`);
 if(permissionRows.error) throw new Error(`Unable to resolve navigation permissions: ${permissionRows.error.message}`);
 const permissions=(permissionRows.data??[]).map(row=>String(row.permission_code));
 if(!permissions.length) return "teacher";
 const roleKeys=(roleRows.data??[]).map(row=>String(row.key));
 return classifyNavigationAudience(roleKeys,permissions);
}

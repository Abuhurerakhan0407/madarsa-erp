import { createAdminClient } from "@/lib/supabase/admin";
import type { TenantContext } from "@/lib/tenancy/context";
import type { NavigationAudience } from "./client-v3-navigation";

const OFFICE_PREFIXES=["settings.","admissions.","people.employee.","hr.employee.","report.","document.","documents."];
const TEACHING_PREFIXES=["attendance.student.","learning.","assessment.marks."];

export function classifyNavigationAudience(roleKeys:string[],permissions:string[]):NavigationAudience{
 const normalized=roleKeys.map(v=>v.toLowerCase());
 const office=permissions.some(code=>OFFICE_PREFIXES.some(prefix=>code.startsWith(prefix)));
 const teaching=permissions.some(code=>TEACHING_PREFIXES.some(prefix=>code.startsWith(prefix)));
 const studentRead=permissions.includes("students.profile.read");
 const teacherRole=normalized.some(key=>key==="teacher"||key.startsWith("teacher_")||key.endsWith("_teacher"));
 return !office&&studentRead&&teaching&&(teacherRole||permissions.includes("attendance.student.mark"))?"teacher":"office";
}

export async function getNavigationAudience(workspace:TenantContext):Promise<NavigationAudience>{
 const admin=createAdminClient();
 const roles=await admin.from("membership_roles").select("role_id").eq("tenant_id",workspace.tenantId).eq("membership_id",workspace.membershipId);
 if(roles.error) throw new Error(`Unable to resolve navigation roles: ${roles.error.message}`);
 const roleIds=(roles.data??[]).map(row=>Number(row.role_id)).filter(Number.isFinite);
 if(!roleIds.length) return "office";
 const [roleRows,permissionRows]=await Promise.all([
  admin.from("roles").select("key").eq("tenant_id",workspace.tenantId).in("id",roleIds),
  admin.from("role_permissions").select("permission_code").eq("tenant_id",workspace.tenantId).in("role_id",roleIds)
 ]);
 if(roleRows.error) throw new Error(`Unable to resolve navigation role names: ${roleRows.error.message}`);
 if(permissionRows.error) throw new Error(`Unable to resolve navigation permissions: ${permissionRows.error.message}`);
 return classifyNavigationAudience((roleRows.data??[]).map(row=>String(row.key)),(permissionRows.data??[]).map(row=>String(row.permission_code)));
}

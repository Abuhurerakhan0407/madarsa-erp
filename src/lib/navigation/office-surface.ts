import { redirect } from "next/navigation";
import { operatorHasPermissions, type PermissionMatchMode } from "@/lib/access/operator-permission";
import { getTenantContext } from "@/lib/tenancy/context";

function safeLocale(value: string): "en" | "ur" {
  return value === "ur" ? "ur" : "en";
}

export async function requireOfficeSurface(
  locale: string,
  permissions: readonly string[] = ["people.person.read"],
  mode: PermissionMatchMode = "all"
) {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) redirect("/onboarding");
  if (!(await operatorHasPermissions(workspace, permissions, mode))) {
    redirect(`/${safeLocale(locale)}/forbidden`);
  }
  return workspace;
}

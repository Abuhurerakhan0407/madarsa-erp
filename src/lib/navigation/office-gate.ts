import { redirect } from "next/navigation";
import type { SupportedLocale } from "@/lib/i18n/config";
import { getTenantContext } from "@/lib/tenancy/context";
import { getNavigationAudience } from "./audience";

/**
 * Prevent direct URL access to office-only workspaces.
 * Database/RPC permissions remain the authoritative data boundary; this gate keeps
 * teacher and unclassified sessions from falling into operator pages and surfacing
 * avoidable permission errors as 500s.
 */
export async function requireOfficeAudience(locale: SupportedLocale) {
  const workspace = await getTenantContext();
  if (!workspace) redirect("/login");

  const audience = await getNavigationAudience(workspace);
  if (audience === "teacher") redirect(`/${locale}/my-students`);
  if (audience !== "office") redirect(`/${locale}`);

  return workspace;
}

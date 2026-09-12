import { redirect } from "next/navigation";
import { getNavigationAudience } from "@/lib/navigation/audience";
import { getTenantContext } from "@/lib/tenancy/context";

function safeLocale(value: string): "en" | "ur" | "ar" {
  return value === "ur" || value === "ar" ? value : "en";
}

export async function requireOfficeSurface(locale: string) {
  const workspace = await getTenantContext();
  if (!workspace) redirect("/onboarding");
  const audience = await getNavigationAudience(workspace);
  if (audience !== "office") redirect(`/${safeLocale(locale)}/forbidden`);
  return workspace;
}

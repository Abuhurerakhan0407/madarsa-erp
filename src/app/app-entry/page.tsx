import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveOperatorAppDestination } from "@/lib/auth/app-entry-destination";
import { portalHref } from "@/lib/portal/locale";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export default async function AppEntryPage() {
  const identity = await getVerifiedIdentity();
  if (!identity) redirect("/login?source=app");

  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "ur" ? "ur" : "en";

  const workspace = await getTenantContext();
  if (workspace) {
    const storedRoute = cookieStore.get("ILMGAAH_LAST_ROUTE")?.value;
    redirect(resolveOperatorAppDestination(storedRoute, locale));
  }

  redirect(portalHref("/portal", locale));
}

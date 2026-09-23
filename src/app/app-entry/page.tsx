import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { portalHref } from "@/lib/portal/locale";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export default async function AppEntryPage() {
  const identity = await getVerifiedIdentity();
  if (!identity) redirect("/login?source=app");

  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "ur" ? "ur" : "en";

  const workspace = await getTenantContext();
  if (workspace) redirect(`/${locale}`);

  const admin = createAdminClient();
  const { data: portalLink, error } = await admin
    .from("identity_person_links")
    .select("tenant_id")
    .eq("identity_id", identity.id)
    .eq("status", "verified")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to resolve app destination: ${error.message}`);
  }

  if (portalLink?.tenant_id) {
    redirect(portalHref("/portal", locale, { tenant: Number(portalLink.tenant_id) }));
  }

  redirect("/onboarding");
}

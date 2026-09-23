import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { portalHref } from "@/lib/portal/locale";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export default async function AppEntryPage() {
  const identity = await getVerifiedIdentity();
  if (!identity) redirect("/login?source=app");

  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "ur" ? "ur" : "en";

  const workspace = await getTenantContext();
  if (workspace) redirect(`/${locale}`);

  redirect(portalHref("/portal", locale));
}

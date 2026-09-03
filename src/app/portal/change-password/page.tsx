import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortalPasswordChangeForm } from "@/components/portal-password-change-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";

export const metadata: Metadata = { title: "Change password | Madarsa ERP" };

export default async function PortalChangePasswordPage() {
  const identity = await getVerifiedIdentity();
  if (!identity) redirect("/login?next=%2Fportal%2Fchange-password");

  const admin = createAdminClient();
  const current = await admin.auth.admin.getUserById(identity.id);
  if (current.error || !current.data.user) throw new Error("Unable to load portal account.");
  if (current.data.user.app_metadata?.must_change_password !== true) redirect("/portal");

  return (
    <section className="professional-card" style={{ maxWidth: 640, margin: "8vh auto 0" }}>
      <p className="state-kicker">Security required</p>
      <h1>Set your own password</h1>
      <p>The temporary password has done its job. Replace it before opening the parent portal.</p>
      <PortalPasswordChangeForm />
    </section>
  );
}

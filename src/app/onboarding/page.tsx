import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedIdentity } from "@/lib/supabase/identity";

export default async function OnboardingPage() {
  const identity = await getVerifiedIdentity();

  if (!identity) {
    redirect("/login?next=/onboarding");
  }

  const supabase = await createClient();
  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("identity_id", identity.id)
    .eq("status", "active")
    .limit(1);

  if (error) {
    throw new Error(`Unable to read account membership: ${error.message}`);
  }

  if (memberships?.length) {
    redirect("/en");
  }

  return (
    <main className="onboarding-screen">
      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <header className="onboarding-header">
          <div className="auth-brand">
            <span className="brand-mark" aria-hidden="true">M</span>
            <div>
              <strong>Madarsa ERP</strong>
              <span>Secure institution setup</span>
            </div>
          </div>
          <div>
            <p className="state-kicker">Workspace setup</p>
            <h1 id="onboarding-title">Create your institution foundation</h1>
            <p>
              This creates your isolated tenant, first branch, owner access, and role permissions.
            </p>
          </div>
        </header>

        <OnboardingForm email={identity.email} />
      </section>
    </main>
  );
}

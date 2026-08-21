import { notFound } from "next/navigation";
import { PublicAdmissionForm } from "@/components/public-admission-form";
import { getPublicAdmissionsContext } from "@/lib/admissions/public-intake-context";
import { normalizePublicAdmissionLocale } from "@/lib/admissions/public-intake-model";

export const dynamic = "force-dynamic";

type PublicAdmissionPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
};

export default async function PublicAdmissionPage({
  params,
  searchParams
}: PublicAdmissionPageProps) {
  const [{ tenantSlug }, query] = await Promise.all([params, searchParams]);
  const rawLanguage = Array.isArray(query.lang) ? query.lang[0] : query.lang;
  const locale = normalizePublicAdmissionLocale(rawLanguage);
  const context = await getPublicAdmissionsContext(tenantSlug);

  if (!context) notFound();

  return (
    <PublicAdmissionForm
      tenantName={context.tenant.name}
      branchName={context.branch.name}
      tenantSlug={context.tenant.slug}
      locale={locale}
      formLabels={context.form.labels}
      sessions={context.sessions}
      programs={context.programs}
      sections={context.form.sections}
    />
  );
}

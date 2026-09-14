import { notFound } from "next/navigation";
import { PublicAdmissionForm } from "@/components/public-admission-form";
import { getPublicAdmissionsContext } from "@/lib/admissions/public-intake-context";
import { normalizePublicAdmissionLocale } from "@/lib/admissions/public-intake-model";

export const dynamic = "force-dynamic";

type PublicAdmissionPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
};

const TRANSIENT_PUBLIC_INTAKE_PATTERN =
  /bad gateway|failed to get api key info|failed to get project config|fetch failed|network|timeout|timed out|502|503|504|connection reset|socket/i;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "Unknown public admission error");
}

function isTransientPublicIntakeError(error: unknown): boolean {
  return TRANSIENT_PUBLIC_INTAKE_PATTERN.test(errorMessage(error));
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadPublicAdmissionsContext(tenantSlug: string) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await getPublicAdmissionsContext(tenantSlug);
    } catch (error) {
      lastError = error;
      if (!isTransientPublicIntakeError(error) || attempt === 2) throw error;
      await wait(140 * (attempt + 1));
    }
  }

  throw lastError;
}

export default async function PublicAdmissionPage({
  params,
  searchParams
}: PublicAdmissionPageProps) {
  const [{ tenantSlug }, query] = await Promise.all([params, searchParams]);
  const rawLanguage = Array.isArray(query.lang) ? query.lang[0] : query.lang;
  const locale = normalizePublicAdmissionLocale(rawLanguage);
  const context = await loadPublicAdmissionsContext(tenantSlug);

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
      groups={context.groups}
      sections={context.form.sections}
      requirePhoto={context.tenant.clientProfile === "client-v2"}
    />
  );
}

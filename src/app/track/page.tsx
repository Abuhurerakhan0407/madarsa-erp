import { PublicAdmissionTracker } from "@/components/public-admission-tracker";
import { normalizePublicAdmissionLocale } from "@/lib/admissions/public-intake-model";

type TrackingPageProps = {
  searchParams: Promise<{ lang?: string | string[]; ref?: string | string[] }>;
};

export default async function TrackingPage({ searchParams }: TrackingPageProps) {
  const query = await searchParams;
  const rawLanguage = Array.isArray(query.lang) ? query.lang[0] : query.lang;
  const rawReference = Array.isArray(query.ref) ? query.ref[0] : query.ref;
  const locale = normalizePublicAdmissionLocale(rawLanguage);
  const initialReference = typeof rawReference === "string" && rawReference.length <= 64
    ? rawReference
    : "";

  return <PublicAdmissionTracker locale={locale} initialReference={initialReference} />;
}

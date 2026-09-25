import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAttendanceV2Section } from "@/components/portal-attendance-v2-section";
import { PortalNotificationCenter } from "@/components/portal-notification-center";
import { PortalParentDocuments } from "@/components/portal-parent-documents";
import { PortalParentPriorityOverview } from "@/components/portal-parent-priority-overview";
import { PortalTeacherWorkspace } from "@/components/portal-teacher-workspace";
import { PortalExitButton } from "@/components/portal-exit-button";
import { SignOutButton } from "@/components/sign-out-button";
import { getDirection } from "@/lib/i18n/config";
import { getPortalNotificationCenter } from "@/lib/notifications/portal";
import { getPortalGuardianDocuments } from "@/lib/portal/documents";
import { formatPortalDateTime, localizedPortalText, portalHref, resolvePortalLocale } from "@/lib/portal/locale";
import { getPortalHome } from "@/lib/portal/runtime";
import { getPortalTeacherWorkspace } from "@/lib/portal/teacher-workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export const metadata: Metadata = { title: "Parent & Teacher Portal | Ilmgaah" };
type Raw = Record<string, unknown>;
const object = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const rows = (value: unknown): Raw[] => Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Raw[] : [];
const text = (value: unknown) => typeof value === "string" ? value : "";
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

const copy = {
  en: {
    portal: "Parent & Teacher Portal",
    noAccess: "No portal access linked yet",
    noAccessBody: "Sign in is working, but this account has not been linked to a verified guardian or teacher record.",
    returnHome: "Back to home",
    returnLogin: "Back to login",
    returnError: "Unable to leave this page. Please try again.",
    secure: "Secure self-service portal",
    institutions: "Portal institutions",
    language: "Language",
    signOut: "Sign out",
    account: "Portal account",
    notices: "Institution notices",
    archive: "Notice archive",
    noNotices: "No published portal notices.",
    audience: { tenant: "Institution", parents: "Parents", employees: "Teachers" },
    linkType: { guardian: "Guardian", employee: "Teacher" }
  },
  ur: {
    portal: "والدین اور اساتذہ پورٹل",
    noAccess: "ابھی کوئی پورٹل رسائی منسلک نہیں",
    noAccessBody: "سائن اِن درست کام کر رہا ہے، لیکن یہ اکاؤنٹ ابھی کسی تصدیق شدہ سرپرست یا استاد کے ریکارڈ سے منسلک نہیں ہے۔",
    returnHome: "ہوم پر واپس جائیں",
    returnLogin: "لاگ اِن پر واپس جائیں",
    returnError: "اس صفحے سے واپس نہیں جا سکے۔ دوبارہ کوشش کریں۔",
    secure: "محفوظ سیلف سروس پورٹل",
    institutions: "پورٹل ادارے",
    language: "زبان",
    signOut: "سائن آؤٹ",
    account: "پورٹل اکاؤنٹ",
    notices: "ادارے کی اطلاعات",
    archive: "اطلاعات کا ریکارڈ",
    noNotices: "کوئی شائع شدہ پورٹل اطلاع نہیں۔",
    audience: { tenant: "ادارہ", parents: "والدین", employees: "اساتذہ" },
    linkType: { guardian: "سرپرست", employee: "استاد" }
  }
} as const;

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ tenant?: string | string[]; locale?: string | string[] }> }) {
  const params = await searchParams;
  const locale = resolvePortalLocale(typeof params.locale === "string" ? params.locale : null);
  const t = copy[locale];
  const tenantParam = typeof params.tenant === "string" ? params.tenant : undefined;
  const requestedPortal = portalHref("/portal", locale, { tenant: tenantParam });
  const identity = await getVerifiedIdentity();
  if (!identity) redirect(`/login?next=${encodeURIComponent(requestedPortal)}`);

  const admin = createAdminClient();
  const current = await admin.auth.admin.getUserById(identity.id);
  if (current.error || !current.data.user) throw new Error("Unable to load portal account.");
  if (current.data.user.app_metadata?.must_change_password === true) {
    redirect(portalHref("/portal/change-password", locale, { tenant: tenantParam }));
  }

  const { data: linkRows, error: linkError } = await admin
    .from("identity_person_links")
    .select("tenant_id,person_id,link_type")
    .eq("identity_id", identity.id)
    .eq("status", "verified");
  if (linkError) throw new Error(`Unable to load portal accounts: ${linkError.message}`);

  const links = linkRows ?? [];
  const tenantIds = [...new Set(links.map((row) => Number(row.tenant_id)).filter((id) => Number.isInteger(id) && id > 0))];
  const localeNav = (
    <nav className="locale-switcher" aria-label={t.language}>
      <Link className="locale-link" aria-current={locale === "en" ? "page" : undefined} href={portalHref("/portal", "en", { tenant: tenantParam })}>English</Link>
      <Link className="locale-link" aria-current={locale === "ur" ? "page" : undefined} href={portalHref("/portal", "ur", { tenant: tenantParam })}>اردو</Link>
    </nav>
  );

  if (tenantIds.length === 0) {
    const workspace = await getTenantContext();
    return (
      <section className="professional-card" lang={locale} dir={getDirection(locale)} style={{ maxWidth: 720, margin: "8vh auto 0" }}>
        {localeNav}
        <p className="state-kicker">{t.portal}</p>
        <h1>{t.noAccess}</h1>
        <p>{t.noAccessBody}</p>
        <div className="quick-actions">
          <PortalExitButton
            homeHref={workspace ? `/${locale}` : null}
            loginHref="/login?source=app"
            homeLabel={t.returnHome}
            loginLabel={t.returnLogin}
            errorLabel={t.returnError}
          />
        </div>
      </section>
    );
  }

  const requested = Number(tenantParam);
  if (!Number.isInteger(requested) || !tenantIds.includes(requested)) {
    if (tenantIds.length === 1) redirect(portalHref("/portal", locale, { tenant: tenantIds[0] }));
  }
  const tenantId = Number.isInteger(requested) && tenantIds.includes(requested) ? requested : tenantIds[0];

  const [{ data: tenants, error: tenantError }, home, notifications, teacherWorkspace, guardianDocuments] = await Promise.all([
    admin.from("tenants").select("id,name").in("id", tenantIds),
    getPortalHome(tenantId),
    getPortalNotificationCenter(tenantId),
    getPortalTeacherWorkspace(tenantId),
    getPortalGuardianDocuments(tenantId)
  ]);
  if (tenantError) throw new Error(`Unable to load institution: ${tenantError.message}`);

  const currentTenant = tenants?.find((item) => Number(item.id) === tenantId);
  const children = rows(home.children);
  const employee = object(home.employee);
  const notices = rows(home.notices);
  const portalLinks = rows(home.links);
  const overview = object(home.overview);
  const guardianView = portalLinks.some((link) => text(link.link_type) === "guardian");

  return (
    <div className="flow-stack" lang={locale} dir={getDirection(locale)}>
      <header className="professional-card">
        <div className="section-heading">
          <div>
            <p className="state-kicker">{t.secure}</p>
            <h1>{currentTenant?.name ?? "Ilmgaah"}</h1>
            <p>{portalLinks.map((link) => `${text(link.display_name)} · ${t.linkType[text(link.link_type) as keyof typeof t.linkType] ?? text(link.link_type)}`).join(" · ")}</p>
          </div>
          <div className="quick-actions">
            {localeNav}
            <SignOutButton
              label={t.signOut}
              initials="ME"
              title={identity.email ?? t.account}
              locale={locale}
              afterSignOut={`/login?next=${encodeURIComponent(portalHref("/portal", locale, { tenant: tenantId }))}`}
            />
          </div>
        </div>
        {tenantIds.length > 1 ? (
          <nav aria-label={t.institutions} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            {tenants?.map((tenant) => <Link className="action-button" key={tenant.id} href={portalHref("/portal", locale, { tenant: tenant.id })}>{tenant.name}</Link>)}
          </nav>
        ) : null}
      </header>

      {guardianView ? <>
        <PortalParentPriorityOverview
          tenantId={tenantId}
          locale={locale}
          overview={overview}
          linkedChildren={children}
          attendance={<PortalAttendanceV2Section tenantId={tenantId} locale={locale} />}
        />
        <PortalParentDocuments tenantId={tenantId} locale={locale} students={guardianDocuments} />
      </> : null}

      {teacherWorkspace ? <PortalTeacherWorkspace locale={locale} workspace={teacherWorkspace} employee={employee} /> : null}

      <PortalNotificationCenter tenantId={tenantId} initial={notifications} locale={locale} />

      <section className="professional-card">
        <div className="section-heading">
          <div><p className="state-kicker">{t.notices}</p><h2>{t.archive}</h2></div>
        </div>
        {notices.length === 0 ? <p>{t.noNotices}</p> : (
          <div className="flow-stack">
            {notices.map((notice) => {
              const audience = text(notice.audience_type);
              return (
                <article className="demo-card" key={num(notice.id)}>
                  <p className="state-kicker">{t.audience[audience as keyof typeof t.audience] ?? audience}</p>
                  <h3>{localizedPortalText(notice.labels, locale, "—")}</h3>
                  <p>{localizedPortalText(notice.body, locale)}</p>
                  <small>{formatPortalDateTime(notice.published_at, locale)}</small>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

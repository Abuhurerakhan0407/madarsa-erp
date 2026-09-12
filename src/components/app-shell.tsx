import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { AppNavLink } from "@/components/app-nav-link";
import { GlobalStudentSearch } from "@/components/global-student-search";
import { InterfaceMotion } from "@/components/interface-motion";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { MobileNavigation } from "@/components/mobile-navigation";
import { SignOutButton } from "@/components/sign-out-button";
import type { Locale } from "@/lib/i18n/config";
import { getNavigationAudience } from "@/lib/navigation/audience";
import { getClientV3Navigation } from "@/lib/navigation/client-v3-navigation";
import type { TenantContext } from "@/lib/tenancy/context";

type AppShellProps={children:ReactNode;locale:Locale;workspace:TenantContext};
const shellCopy={
 en:{productLine:"Institution operations",year:"Academic year 2026–27",navigation:"Workspace navigation",menu:"Menu",close:"Close menu",workspace:"Workspace",more:"More",newAdmission:"+ New Admission"},
 ur:{productLine:"ادارہ آپریشنز",year:"تعلیمی سال 2026–27",navigation:"ورک اسپیس نیویگیشن",menu:"مینو",close:"مینو بند کریں",workspace:"ورک اسپیس",more:"مزید",newAdmission:"+ نیا داخلہ"},
 ar:{productLine:"عمليات المؤسسة",year:"العام الدراسي 2026–27",navigation:"تنقل مساحة العمل",menu:"القائمة",close:"إغلاق القائمة",workspace:"مساحة العمل",more:"المزيد",newAdmission:"+ قبول جديد"}
} as const;
function initials(name:string){return name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]?.toUpperCase()).join("")||"ME";}

export async function AppShell({children,locale,workspace}:AppShellProps){
 const app=await getTranslations("App");const branchLabel=workspace.branchName||"Main Branch";const copy=shellCopy[locale];const audience=await getNavigationAudience(workspace);const nav=getClientV3Navigation(audience);
 const mobileGroups=[{key:"menu",label:copy.more,items:(audience==="office"?[nav.primary[4],...nav.more]:nav.primary).map(i=>({key:i.key,label:i.labels[locale],href:i.href(locale)}))}];
 const quickItems=nav.mobile.map(i=>({key:i.key,label:i.labels[locale],href:i.href(locale)}));
 return <div className="app-shell professional-shell client-v2-shell" data-client-v3 data-navigation-audience={audience}>
  <a className="skip-link" href="#main-content">{app("skipToContent")}</a>
  <aside className="sidebar professional-sidebar client-v2-sidebar" aria-label={copy.navigation}>
   <div className="brand-lockup professional-brand-lockup"><span className="brand-mark" aria-hidden="true">I</span><span className="brand-copy"><strong>Ilmgaah</strong><small>{copy.productLine}</small></span></div>
   <div className="institution-card professional-institution-card client-v2-institution"><span className="client-v2-institution-label">{copy.workspace}</span><strong>{workspace.tenantName}</strong><span>{branchLabel}</span><small>{copy.year}</small></div>
    <nav aria-label={copy.navigation} className="primary-nav demo-primary-nav client-v2-primary-nav">
     <div className="nav-section">{nav.primary.map(i=><AppNavLink href={i.href(locale)} key={i.key} className="nav-link"><span className="nav-indicator" aria-hidden="true"/><span>{i.labels[locale]}</span></AppNavLink>)}</div>
     {nav.more.length?<details className="nav-section" open><summary className="nav-section-label" style={{cursor:"pointer"}}>{copy.more}</summary>{nav.more.map(i=><AppNavLink href={i.href(locale)} key={i.key} className="nav-link"><span className="nav-indicator" aria-hidden="true"/><span>{i.labels[locale]}</span></AppNavLink>)}</details>:null}
    </nav>
    <LocaleSwitcher currentLocale={locale} label={`${app("changeLanguage")} — sidebar`}/>
  </aside>
  <div className="workspace">
   <header className="topbar professional-topbar client-v2-topbar" style={{gap:".75rem",flexWrap:"wrap"}}>
    <div className="topbar-school-context"><p className="topbar-context">{workspace.tenantName}</p><p className="topbar-session">{branchLabel} · {copy.year}</p></div>
     {audience==="office"?<GlobalStudentSearch locale={locale}/>:null}
     <div className="topbar-actions">{audience==="office"?<Link className="action-button action-button-primary" href={`/${locale}/students/new`}>{copy.newAdmission}</Link>:null}<LocaleSwitcher currentLocale={locale} label={`${app("changeLanguage")} — topbar`}/><SignOutButton label={app("userMenu")} initials={initials(workspace.displayName)} title={workspace.displayName}/></div>
   </header>
   <main id="main-content" className="main-content professional-main-content client-v2-main"><InterfaceMotion/>{children}</main>
  </div>
  <MobileNavigation groups={mobileGroups} quickItems={quickItems} menuLabel={copy.menu} closeLabel={copy.close} navigationLabel={copy.navigation} institutionName={workspace.tenantName} branchLabel={branchLabel}/>
 </div>;
}

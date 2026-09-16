import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { SupportedLocale } from "@/lib/i18n/config";
import { createCustomRole, getAccessAdministrationCenter, setCustomRolePermissions, setMembershipBranchScope, setMembershipCustomRole } from "@/lib/access/administration";

const copy = {
  en: {
    kicker: "Administration",
    title: "People & Access",
    description: "Manage custom roles and branch access for existing institution members. System-owner access and account creation stay protected outside this workspace.",
    newRole: "Create custom role",
    key: "Role code",
    name: "Role name",
    create: "Create role",
    roles: "Roles",
    permissions: "Permissions",
    savePermissions: "Save permissions",
    members: "Members",
    member: "Institution member",
    scope: "Branch access",
    roleAssignment: "Custom role assignment",
    assign: "Assign",
    remove: "Remove",
    allBranches: "All branches",
    selectedBranches: "Selected branches",
    saveScope: "Save branch access",
    system: "System",
    custom: "Custom",
    locked: "Current administrator scope is protected",
    none: "No records yet.",
    status: "Status"
  },
  ur: {
    kicker: "انتظامیہ",
    title: "افراد اور رسائی",
    description: "ادارے کے موجودہ اراکین کے کسٹم رولز اور برانچ رسائی منظم کریں۔ سسٹم اونر رسائی اور اکاؤنٹ بنانا اس ورک اسپیس سے محفوظ رکھا گیا ہے۔",
    newRole: "کسٹم رول بنائیں",
    key: "رول کوڈ",
    name: "رول نام",
    create: "رول بنائیں",
    roles: "رولز",
    permissions: "اجازتیں",
    savePermissions: "اجازتیں محفوظ کریں",
    members: "اراکین",
    member: "ادارے کا رکن",
    scope: "برانچ رسائی",
    roleAssignment: "کسٹم رول اسائنمنٹ",
    assign: "اسائن",
    remove: "ہٹائیں",
    allBranches: "تمام برانچز",
    selectedBranches: "منتخب برانچز",
    saveScope: "برانچ رسائی محفوظ کریں",
    system: "سسٹم",
    custom: "کسٹم",
    locked: "موجودہ ایڈمن کی برانچ رسائی محفوظ ہے",
    none: "ابھی کوئی ریکارڈ نہیں۔",
    status: "حالت"
  }
} as const;

export default async function AccessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!routing.locales.includes(raw as SupportedLocale)) notFound();
  const locale = raw as SupportedLocale;
  const t = copy[locale];
  const data = await getAccessAdministrationCenter();
  const customRoles = data.roles.filter((role) => !role.isSystem && role.status === "active");

  async function createRoleAction(formData: FormData) {
    "use server";
    const key = String(formData.get("key") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    if (key && name) await createCustomRole({ key, name });
    revalidatePath(`/${locale}/access`);
  }

  async function permissionsAction(formData: FormData) {
    "use server";
    const roleId = Number(formData.get("roleId"));
    const permissionCodes = formData.getAll("permissions").map(String);
    if (roleId) await setCustomRolePermissions({ roleId, permissionCodes });
    revalidatePath(`/${locale}/access`);
  }

  async function membershipRoleAction(formData: FormData) {
    "use server";
    const membershipId = Number(formData.get("membershipId"));
    const roleId = Number(formData.get("roleId"));
    const assigned = String(formData.get("operation")) === "assign";
    if (membershipId && roleId) await setMembershipCustomRole({ membershipId, roleId, assigned });
    revalidatePath(`/${locale}/access`);
  }

  async function scopeAction(formData: FormData) {
    "use server";
    const membershipId = Number(formData.get("membershipId"));
    const allBranches = formData.get("allBranches") === "on";
    const branchIds = formData.getAll("branchIds").map(Number).filter(Number.isFinite);
    if (membershipId) await setMembershipBranchScope({ membershipId, allBranches, branchIds });
    revalidatePath(`/${locale}/access`);
  }

  return <>
    <section className="page-heading" data-page-section><div><p className="state-kicker">{t.kicker}</p><h1>{t.title}</h1><p>{t.description}</p></div><span>{data.branches.length} · {data.roles.length}</span></section>
    <section className="professional-grid" data-page-section>
      <article className="professional-card"><h2>{t.newRole}</h2><form action={createRoleAction} className="professional-form"><label>{t.key}<input name="key" required pattern="[a-z][a-z0-9_]{1,63}" maxLength={64} /></label><label>{t.name}<input name="name" required minLength={2} maxLength={120} /></label><button className="action-button action-button-primary" type="submit">{t.create}</button></form></article>
      <article className="professional-card"><h2>{t.scope}</h2>{data.branches.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>{t.name}</th><th>{t.status}</th></tr></thead><tbody>{data.branches.map((branch) => <tr key={branch.id}><td>{branch.name}</td><td><span className={`status-pill status-${branch.status}`}>{branch.status}</span></td></tr>)}</tbody></table></div> : <p>{t.none}</p>}</article>
    </section>
    <section className="professional-card" data-page-section><div className="section-heading"><div><p className="state-kicker">{t.roles}</p><h2>{t.roles}</h2></div><span>{data.roles.length}</span></div><div className="professional-grid">{data.roles.map((role) => <article className="professional-card" key={role.id}><div className="section-heading"><div><h3>{role.name}</h3></div><span>{role.isSystem ? t.system : t.custom}</span></div><p>{role.permissions.length} {t.permissions.toLowerCase()} · {role.memberCount} {t.members.toLowerCase()}</p>{role.isSystem ? <p>{t.locked}</p> : <form action={permissionsAction} className="professional-form"><input type="hidden" name="roleId" value={role.id} /><label>{t.permissions}<select name="permissions" multiple size={12} defaultValue={role.permissions}>{data.permissions.map((permission) => <option key={permission.code} value={permission.code}>{permission.description}</option>)}</select></label><button className="action-button" type="submit">{t.savePermissions}</button></form>}</article>)}</div></section>
    <section className="professional-card" data-page-section><div className="section-heading"><div><p className="state-kicker">{t.members}</p><h2>{t.members}</h2></div><span>{data.memberships.length}</span></div>{data.memberships.map((membership) => <article className="professional-card" key={membership.id}><div className="section-heading"><div><h3>{membership.roles.map((role) => role.name).join(", ") || t.member}</h3><p>{membership.allBranches ? t.allBranches : membership.branchScopes.map((scope) => scope.name).join(", ") || t.selectedBranches}</p></div><span>{membership.status}</span></div>{customRoles.length ? <form action={membershipRoleAction} className="inline-form"><input type="hidden" name="membershipId" value={membership.id} /><select name="roleId" required defaultValue=""><option value="" disabled>{t.roleAssignment}</option>{customRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select><button className="action-button" name="operation" value="assign" type="submit">{t.assign}</button><button className="action-button" name="operation" value="remove" type="submit">{t.remove}</button></form> : null}{membership.isCurrentAdmin ? <p>{t.locked}</p> : <form action={scopeAction} className="professional-form"><input type="hidden" name="membershipId" value={membership.id} /><label><input type="checkbox" name="allBranches" defaultChecked={membership.allBranches} /> {t.allBranches}</label><fieldset><legend>{t.selectedBranches}</legend>{data.branches.filter((branch) => branch.status === "active").map((branch) => <label key={branch.id}><input type="checkbox" name="branchIds" value={branch.id} defaultChecked={membership.branchScopes.some((scope) => scope.id === branch.id)} /> {branch.name}</label>)}</fieldset><button className="action-button" type="submit">{t.saveScope}</button></form>}</article>)}</section>
  </>;
}

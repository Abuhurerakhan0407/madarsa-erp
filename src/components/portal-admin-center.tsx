"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/lib/i18n/config";
import { formatPortalDate, formatPortalDateTime, preservePortalLocale } from "@/lib/portal/locale";
import type { PortalAccessCandidate, PortalOperatorCenter } from "@/lib/portal/runtime";

type Props = {
  center: PortalOperatorCenter;
  initialTab?: "parents" | "teachers";
  locale: SupportedLocale;
};
type Credential = { name: string; email: string; password: string | null };
type IssuedCode = { name: string; code: string; claimPath: string };
type Raw = Record<string, unknown>;

const raw = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const text = (value: unknown) => typeof value === "string" ? value : "";

const copy = {
  en: {
    shareOnce: "Share once",
    portalLogin: "portal login",
    done: "Done",
    temporaryPassword: "This temporary password is shown only in this response. The user must change it on first login.",
    copyPassword: "Copy password",
    existingLogin: "Existing login linked safely. Its password was not changed.",
    fallbackCode: "Fallback claim code",
    fallbackBody: "This one-time code is for the existing claim-code flow; it does not reveal or store a password.",
    accessKicker: "Parent & Teacher Access",
    accounts: "Portal accounts",
    accountsBody: "Create or link logins, reset ERP-managed passwords, and disable only this institution's access.",
    eligible: "eligible",
    parents: "Parents",
    teachers: "Teachers",
    name: "Name",
    email: "Email",
    scope: "Linked child / classes",
    account: "Account",
    lastLogin: "Last login",
    actions: "Actions",
    emailRequired: "Email required",
    active: "Active",
    disabled: "Disabled",
    notCreated: "Not created",
    never: "Never",
    noLinkedChild: "No linked child/class",
    noAssignedClass: "No assigned class",
    student: "Student",
    group: "Group",
    creating: "Creating…",
    createLogin: "Create login",
    resetting: "Resetting…",
    resetPassword: "Reset password",
    disabling: "Disabling…",
    disable: "Disable",
    enabling: "Enabling…",
    enable: "Enable",
    issuing: "Issuing…",
    issueCode: "Issue claim code",
    noEligibleParents: "No eligible parents found for this branch.",
    noEligibleTeachers: "No eligible teachers found for this branch.",
    communication: "Portal communication",
    publishNotice: "Publish a notice",
    audience: "Audience",
    everyone: "Everyone with portal access",
    parentsGuardians: "Parents / guardians",
    teachersEmployees: "Teachers / employees",
    priority: "Priority",
    normal: "Normal",
    important: "Important",
    urgent: "Urgent",
    title: "Title",
    message: "Message",
    publishing: "Publishing…",
    publish: "Publish notice",
    history: "History",
    recentCodes: "Recent claim codes",
    person: "Person",
    type: "Type",
    state: "State",
    expires: "Expires",
    guardian: "Guardian",
    teacher: "Teacher",
    issued: "Issued",
    claimed: "Claimed",
    expired: "Expired",
    revoked: "Revoked",
    credentialsError: "Unable to manage portal credentials. Please try again.",
    accessError: "Unable to update portal access. Please try again.",
    issueError: "Unable to issue an access code. Please try again.",
    publishError: "Unable to publish the notice. Please try again."
  },
  ur: {
    shareOnce: "صرف ایک بار شیئر کریں",
    portalLogin: "پورٹل لاگ اِن",
    done: "مکمل",
    temporaryPassword: "یہ عارضی پاس ورڈ صرف اسی جواب میں دکھایا جا رہا ہے۔ صارف کو پہلی لاگ اِن پر اسے تبدیل کرنا ہوگا۔",
    copyPassword: "پاس ورڈ کاپی کریں",
    existingLogin: "موجودہ لاگ اِن محفوظ طریقے سے منسلک ہو گیا۔ اس کا پاس ورڈ تبدیل نہیں کیا گیا۔",
    fallbackCode: "متبادل کلیم کوڈ",
    fallbackBody: "یہ ایک بار استعمال ہونے والا کوڈ موجودہ کلیم کوڈ عمل کے لیے ہے؛ یہ پاس ورڈ ظاہر یا محفوظ نہیں کرتا۔",
    accessKicker: "والدین اور اساتذہ کی رسائی",
    accounts: "پورٹل اکاؤنٹس",
    accountsBody: "لاگ اِن بنائیں یا منسلک کریں، ERP کے زیر انتظام پاس ورڈ ری سیٹ کریں، اور صرف اسی ادارے کی رسائی بند کریں۔",
    eligible: "اہل",
    parents: "والدین",
    teachers: "اساتذہ",
    name: "نام",
    email: "ای میل",
    scope: "منسلک طالب علم / کلاسیں",
    account: "اکاؤنٹ",
    lastLogin: "آخری لاگ اِن",
    actions: "اقدامات",
    emailRequired: "ای میل درکار ہے",
    active: "فعال",
    disabled: "غیر فعال",
    notCreated: "ابھی نہیں بنا",
    never: "کبھی نہیں",
    noLinkedChild: "کوئی طالب علم یا کلاس منسلک نہیں",
    noAssignedClass: "کوئی کلاس مقرر نہیں",
    student: "طالب علم",
    group: "گروپ",
    creating: "بن رہا ہے…",
    createLogin: "لاگ اِن بنائیں",
    resetting: "ری سیٹ ہو رہا ہے…",
    resetPassword: "پاس ورڈ ری سیٹ کریں",
    disabling: "بند ہو رہا ہے…",
    disable: "رسائی بند کریں",
    enabling: "فعال ہو رہی ہے…",
    enable: "رسائی فعال کریں",
    issuing: "کوڈ بن رہا ہے…",
    issueCode: "کلیم کوڈ جاری کریں",
    noEligibleParents: "اس برانچ کے لیے کوئی اہل والدین نہیں ملے۔",
    noEligibleTeachers: "اس برانچ کے لیے کوئی اہل استاد نہیں ملا۔",
    communication: "پورٹل رابطہ",
    publishNotice: "اطلاع شائع کریں",
    audience: "مخاطبین",
    everyone: "تمام پورٹل صارفین",
    parentsGuardians: "والدین / سرپرست",
    teachersEmployees: "اساتذہ / ملازمین",
    priority: "ترجیح",
    normal: "معمول",
    important: "اہم",
    urgent: "فوری",
    title: "عنوان",
    message: "پیغام",
    publishing: "شائع ہو رہی ہے…",
    publish: "اطلاع شائع کریں",
    history: "تاریخ",
    recentCodes: "حالیہ کلیم کوڈز",
    person: "فرد",
    type: "قسم",
    state: "حالت",
    expires: "میعاد",
    guardian: "سرپرست",
    teacher: "استاد",
    issued: "جاری شدہ",
    claimed: "فعال شدہ",
    expired: "میعاد ختم",
    revoked: "منسوخ",
    credentialsError: "پورٹل اسناد منظم نہیں ہو سکیں۔ دوبارہ کوشش کریں۔",
    accessError: "پورٹل رسائی تبدیل نہیں ہو سکی۔ دوبارہ کوشش کریں۔",
    issueError: "رسائی کوڈ جاری نہیں ہو سکا۔ دوبارہ کوشش کریں۔",
    publishError: "اطلاع شائع نہیں ہو سکی۔ دوبارہ کوشش کریں۔"
  }
} as const;

function groupLabel(labels: unknown, locale: SupportedLocale) {
  const values = raw(labels);
  return text(values[locale]) || text(values.en);
}

function scopeLabel(candidate: PortalAccessCandidate, locale: SupportedLocale) {
  const t = copy[locale];
  if (!candidate.linkedScope.length) return candidate.kind === "guardian" ? t.noLinkedChild : t.noAssignedClass;
  return candidate.linkedScope.map((item) => {
    const row = raw(item);
    const group = groupLabel(row.group_labels, locale);
    if (candidate.kind === "guardian") {
      const student = text(row.name) || text(row.student_number) || t.student;
      return `${student}${group ? ` · ${group}` : ""}`;
    }
    return group || `${t.group} ${String(row.group_id ?? "")}`;
  }).join("; ");
}

function statusLabel(status: PortalAccessCandidate["accountStatus"], locale: SupportedLocale) {
  const t = copy[locale];
  return status === "active" ? t.active : status === "disabled" ? t.disabled : status === "email_required" ? t.emailRequired : t.notCreated;
}

function linkTypeLabel(value: string, locale: SupportedLocale) {
  const t = copy[locale];
  return value === "guardian" ? t.guardian : value === "employee" ? t.teacher : value;
}

function codeStateLabel(value: string, locale: SupportedLocale) {
  const t = copy[locale];
  const states: Record<string, string> = { issued: t.issued, claimed: t.claimed, expired: t.expired, revoked: t.revoked, active: t.active, disabled: t.disabled };
  return states[value] ?? value;
}

export function PortalAdminCenter({ center, initialTab = "parents", locale }: Props) {
  const router = useRouter();
  const t = copy[locale];
  const [tab, setTab] = useState<"parents" | "teachers">(initialTab);
  const [busy, setBusy] = useState<string | null>(null);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = tab === "parents" ? center.parents : center.teachers;

  async function credentials(candidate: PortalAccessCandidate, action: "provision" | "reset") {
    const key = `${action}:${candidate.kind}:${candidate.personId}`;
    setBusy(key);
    setError(null);
    setCredential(null);
    try {
      const response = await fetch("/api/portals/credentials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId: candidate.personId, kind: candidate.kind, action })
      });
      const body = await response.json() as { temporaryPassword?: string; email?: string };
      if (!response.ok) throw new Error(t.credentialsError);
      setCredential({ name: candidate.name, email: body.email || candidate.email || "", password: body.temporaryPassword || null });
      router.refresh();
    } catch {
      setError(t.credentialsError);
    } finally {
      setBusy(null);
    }
  }

  async function access(candidate: PortalAccessCandidate, enabled: boolean) {
    const key = `access:${candidate.kind}:${candidate.personId}`;
    setBusy(key);
    setError(null);
    try {
      const response = await fetch("/api/portals/access-state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId: candidate.personId, kind: candidate.kind, enabled })
      });
      if (!response.ok) throw new Error(t.accessError);
      router.refresh();
    } catch {
      setError(t.accessError);
    } finally {
      setBusy(null);
    }
  }

  async function issue(candidate: PortalAccessCandidate) {
    const key = `code:${candidate.kind}:${candidate.personId}`;
    setBusy(key);
    setError(null);
    setIssued(null);
    try {
      const response = await fetch("/api/portals/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId: candidate.personId, linkType: candidate.kind, expiresInDays: 7 })
      });
      const body = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(t.issueError);
      setIssued({ name: candidate.name, code: String(body.code ?? ""), claimPath: String(body.claimPath ?? "") });
      router.refresh();
    } catch {
      setError(t.issueError);
    } finally {
      setBusy(null);
    }
  }

  async function publish(form: FormData) {
    setBusy("notice");
    setError(null);
    try {
      const payload = {
        audienceType: String(form.get("audienceType") ?? "tenant"),
        priority: String(form.get("priority") ?? "normal"),
        title: String(form.get("title") ?? ""),
        body: String(form.get("body") ?? "")
      };
      const response = await fetch("/api/portals/notices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(t.publishError);
      router.refresh();
    } catch {
      setError(t.publishError);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flow-stack" lang={locale}>
      {error ? <div className="notice notice-danger" role="alert">{error}</div> : null}

      {credential ? (
        <section className="professional-card">
          <div className="section-heading">
            <div><p className="state-kicker">{t.shareOnce}</p><h2>{credential.name} · {t.portalLogin}</h2><p>{credential.email}</p></div>
            <button className="action-button" type="button" onClick={() => setCredential(null)}>{t.done}</button>
          </div>
          {credential.password ? <>
            <p>{t.temporaryPassword}</p>
            <div className="code-block"><strong>{credential.password}</strong></div>
            <button className="action-button" type="button" onClick={() => void navigator.clipboard?.writeText(credential.password || "")}>{t.copyPassword}</button>
          </> : <p>{t.existingLogin}</p>}
        </section>
      ) : null}

      {issued ? (
        <section className="professional-card">
          <div className="section-heading">
            <div><p className="state-kicker">{t.fallbackCode}</p><h2>{issued.name}</h2></div>
            <button className="action-button" type="button" onClick={() => setIssued(null)}>{t.done}</button>
          </div>
          <p>{t.fallbackBody}</p>
          <div className="code-block"><strong>{issued.code}</strong></div>
          <p><code>{preservePortalLocale(issued.claimPath, locale)}</code></p>
        </section>
      ) : null}

      <section className="professional-card">
        <div className="section-heading">
          <div><p className="state-kicker">{t.accessKicker}</p><h2>{t.accounts}</h2><p>{t.accountsBody}</p></div>
          <span className="status-pill">{center.parents.length + center.teachers.length} {t.eligible}</span>
        </div>
        <div className="quick-actions" role="tablist">
          <button className={`action-button ${tab === "parents" ? "action-button-primary" : ""}`} type="button" role="tab" aria-selected={tab === "parents"} onClick={() => setTab("parents")}>{t.parents} · {center.parents.length}</button>
          <button className={`action-button ${tab === "teachers" ? "action-button-primary" : ""}`} type="button" role="tab" aria-selected={tab === "teachers"} onClick={() => setTab("teachers")}>{t.teachers} · {center.teachers.length}</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t.name}</th><th>{t.email}</th><th>{t.scope}</th><th>{t.account}</th><th>{t.lastLogin}</th><th>{t.actions}</th></tr></thead>
            <tbody>{list.map((candidate) => {
              const accessKey = `access:${candidate.kind}:${candidate.personId}`;
              const issueKey = `code:${candidate.kind}:${candidate.personId}`;
              const provisionKey = `provision:${candidate.kind}:${candidate.personId}`;
              const resetKey = `reset:${candidate.kind}:${candidate.personId}`;
              return <tr key={`${candidate.kind}:${candidate.personId}`}>
                <td><strong>{candidate.name}</strong>{candidate.reference ? <><br /><small>{candidate.reference}</small></> : null}</td>
                <td>{candidate.email || <span className="status-pill">{t.emailRequired}</span>}</td>
                <td>{scopeLabel(candidate, locale)}</td>
                <td>{statusLabel(candidate.accountStatus, locale)}</td>
                <td>{candidate.lastLogin ? formatPortalDateTime(candidate.lastLogin, locale) : t.never}</td>
                <td><div className="quick-actions">
                  {candidate.accountStatus === "not_created" ? <button className="action-button action-button-primary" type="button" disabled={busy !== null || !candidate.email} aria-busy={busy === provisionKey || undefined} onClick={() => void credentials(candidate, "provision")}>{busy === provisionKey ? t.creating : t.createLogin}</button> : null}
                  {candidate.accountStatus === "active" && candidate.erpManaged ? <button className="action-button" type="button" disabled={busy !== null} aria-busy={busy === resetKey || undefined} onClick={() => void credentials(candidate, "reset")}>{busy === resetKey ? t.resetting : t.resetPassword}</button> : null}
                  {candidate.accountStatus === "active" ? <button className="action-button" type="button" disabled={busy !== null} aria-busy={busy === accessKey || undefined} onClick={() => void access(candidate, false)}>{busy === accessKey ? t.disabling : t.disable}</button> : null}
                  {candidate.accountStatus === "disabled" ? <button className="action-button action-button-primary" type="button" disabled={busy !== null} aria-busy={busy === accessKey || undefined} onClick={() => void access(candidate, true)}>{busy === accessKey ? t.enabling : t.enable}</button> : null}
                  {candidate.accountStatus === "disabled" && candidate.erpManaged ? <button className="action-button" type="button" disabled={busy !== null} aria-busy={busy === resetKey || undefined} onClick={() => void credentials(candidate, "reset")}>{busy === resetKey ? t.resetting : t.resetPassword}</button> : null}
                  {candidate.accountStatus !== "active" ? <button className="action-button" type="button" disabled={busy !== null} aria-busy={busy === issueKey || undefined} onClick={() => void issue(candidate)}>{busy === issueKey ? t.issuing : t.issueCode}</button> : null}
                </div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {list.length === 0 ? <p>{tab === "parents" ? t.noEligibleParents : t.noEligibleTeachers}</p> : null}
      </section>

      <section className="professional-card">
        <p className="state-kicker">{t.communication}</p>
        <h2>{t.publishNotice}</h2>
        <form action={publish} className="flow-form" aria-busy={busy === "notice" || undefined}>
          <label className="field-label">{t.audience}<select name="audienceType" className="text-field" defaultValue="tenant"><option value="tenant">{t.everyone}</option><option value="parents">{t.parentsGuardians}</option><option value="employees">{t.teachersEmployees}</option></select></label>
          <label className="field-label">{t.priority}<select name="priority" className="text-field" defaultValue="normal"><option value="normal">{t.normal}</option><option value="important">{t.important}</option><option value="urgent">{t.urgent}</option></select></label>
          <label className="field-label">{t.title}<input name="title" className="text-field" required minLength={2} maxLength={160} /></label>
          <label className="field-label">{t.message}<textarea name="body" className="text-field" required minLength={2} maxLength={4000} rows={5} /></label>
          <button className="action-button action-button-primary" disabled={busy !== null} type="submit">{busy === "notice" ? t.publishing : t.publish}</button>
        </form>
      </section>

      <section className="professional-card">
        <div className="section-heading"><div><p className="state-kicker">{t.history}</p><h2>{t.recentCodes}</h2></div></div>
        <div className="table-wrap"><table><thead><tr><th>{t.person}</th><th>{t.type}</th><th>{t.state}</th><th>{t.expires}</th></tr></thead><tbody>{center.accessCodes.map((item) => <tr key={item.id}><td>{item.name}</td><td>{linkTypeLabel(item.linkType, locale)}</td><td>{codeStateLabel(item.state, locale)}</td><td>{formatPortalDate(item.expiresAt, locale)}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}

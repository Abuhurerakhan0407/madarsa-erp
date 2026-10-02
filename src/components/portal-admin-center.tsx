"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/lib/i18n/config";
import type { PortalAccessCandidate, PortalOperatorCenter } from "@/lib/portal/runtime";

type Props = {
  center: PortalOperatorCenter;
  initialTab?: "parents" | "teachers";
  locale: SupportedLocale;
};
type Credential = { name: string; email: string; password: string | null; state: string };
const raw = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown) => typeof v === "string" ? v : "";

const copy = {
  en: {
    parent: "Parent",
    teacher: "Teacher",
    student: "Student",
    group: "Group",
    noChild: "No linked child / class",
    noClass: "No assigned class",
    active: "Active",
    disabled: "Disabled",
    emailRequired: "Email required",
    notCreated: "Not created",
    error: "Unable to complete this portal action.",
    shareOnce: "Share once",
    portalLogin: "portal login",
    done: "Done",
    tempPassword: "This temporary password is shown only once. The user must change it on first login.",
    copyPassword: "Copy password",
    existing: "Existing login linked safely. Its password was not changed.",
    fallback: "Fallback claim code",
    claimBody: "This one-time code activates the verified portal link without revealing or storing a password.",
    access: "Parent & Teacher Access",
    accounts: "Portal accounts",
    accountsBody: "Create or link logins, reset Ilmgaah-managed passwords, and disable only this institution's access.",
    eligible: "eligible",
    parents: "Parents",
    teachers: "Teachers",
    name: "Name",
    email: "Email",
    linked: "Linked child / classes",
    account: "Account",
    lastLogin: "Last login",
    actions: "Actions",
    never: "Never",
    creating: "Creating…",
    createLogin: "Create login",
    resetting: "Resetting…",
    resetPassword: "Reset password",
    disable: "Disable",
    enable: "Enable",
    claimCode: "Issue claim code",
    noneEligible: "No eligible records found for this branch.",
    communication: "Portal communication",
    publishNotice: "Publish a notice",
    audience: "Audience",
    everyone: "Everyone with portal access",
    guardians: "Parents / guardians",
    employees: "Teachers / employees",
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
    expires: "Expires"
  },
  ur: {
    parent: "والدین",
    teacher: "استاد",
    student: "طالب علم",
    group: "گروپ",
    noChild: "کوئی منسلک طالب علم / کلاس نہیں",
    noClass: "کوئی مقررہ کلاس نہیں",
    active: "فعال",
    disabled: "غیر فعال",
    emailRequired: "ای میل درکار ہے",
    notCreated: "ابھی نہیں بنا",
    error: "پورٹل کارروائی مکمل نہیں ہو سکی۔",
    shareOnce: "صرف ایک بار شیئر کریں",
    portalLogin: "پورٹل لاگ اِن",
    done: "مکمل",
    tempPassword: "یہ عارضی پاس ورڈ صرف ایک بار دکھایا جاتا ہے۔ صارف کو پہلی لاگ اِن پر اسے تبدیل کرنا ہوگا۔",
    copyPassword: "پاس ورڈ کاپی کریں",
    existing: "موجودہ لاگ اِن محفوظ طریقے سے منسلک ہوا۔ پاس ورڈ تبدیل نہیں کیا گیا۔",
    fallback: "متبادل کلیم کوڈ",
    claimBody: "یہ ایک بار استعمال ہونے والا کوڈ پاس ورڈ ظاہر یا محفوظ کیے بغیر تصدیق شدہ پورٹل ربط فعال کرتا ہے۔",
    access: "والدین اور اساتذہ رسائی",
    accounts: "پورٹل اکاؤنٹس",
    accountsBody: "لاگ اِن بنائیں یا منسلک کریں، Ilmgaah کے زیر انتظام پاس ورڈ ری سیٹ کریں، اور صرف اسی ادارے کی رسائی بند کریں۔",
    eligible: "اہل",
    parents: "والدین",
    teachers: "اساتذہ",
    name: "نام",
    email: "ای میل",
    linked: "منسلک طالب علم / کلاسیں",
    account: "اکاؤنٹ",
    lastLogin: "آخری لاگ اِن",
    actions: "کارروائیاں",
    never: "کبھی نہیں",
    creating: "بن رہا ہے…",
    createLogin: "لاگ اِن بنائیں",
    resetting: "ری سیٹ ہو رہا ہے…",
    resetPassword: "پاس ورڈ ری سیٹ کریں",
    disable: "بند کریں",
    enable: "فعال کریں",
    claimCode: "کلیم کوڈ جاری کریں",
    noneEligible: "اس برانچ کے لیے کوئی اہل ریکارڈ نہیں ملا۔",
    communication: "پورٹل رابطہ",
    publishNotice: "اطلاع شائع کریں",
    audience: "سامعین",
    everyone: "تمام پورٹل صارفین",
    guardians: "والدین / سرپرست",
    employees: "اساتذہ / عملہ",
    priority: "ترجیح",
    normal: "معمول",
    important: "اہم",
    urgent: "فوری",
    title: "عنوان",
    message: "پیغام",
    publishing: "شائع ہو رہا ہے…",
    publish: "اطلاع شائع کریں",
    history: "تاریخچہ",
    recentCodes: "حالیہ کلیم کوڈز",
    person: "شخص",
    type: "قسم",
    state: "حالت",
    expires: "میعاد"
  }
} as const;

function scopeLabel(candidate: PortalAccessCandidate, locale: SupportedLocale) {
  const t = copy[locale];
  if (!candidate.linkedScope.length) return candidate.kind === "guardian" ? t.noChild : t.noClass;
  return candidate.linkedScope.map((item) => {
    const row = raw(item);
    const labels = raw(row.group_labels);
    const group = text(labels[locale]) || text(labels.en) || text(labels.ur);
    if (candidate.kind === "guardian") {
      return `${text(row.name) || text(row.student_number) || t.student}${group ? ` · ${group}` : ""}`;
    }
    return group || `${t.group} ${String(row.group_id ?? "")}`;
  }).join("; ");
}

function statusLabel(status: PortalAccessCandidate["accountStatus"], locale: SupportedLocale) {
  const t = copy[locale];
  return status === "active" ? t.active : status === "disabled" ? t.disabled : status === "email_required" ? t.emailRequired : t.notCreated;
}

export function PortalAdminCenter({ center, initialTab = "parents", locale }: Props) {
  const router = useRouter();
  const t = copy[locale];
  const dateLocale = locale === "ur" ? "ur-PK" : "en-IN";
  const [tab, setTab] = useState<"parents" | "teachers">(initialTab);
  const [busy, setBusy] = useState<string | null>(null);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [issued, setIssued] = useState<{ name: string; code: string; claimPath: string } | null>(null);
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
      const body = await response.json() as { error?: string; email?: string; temporaryPassword?: string; credentialState?: string };
      if (!response.ok) throw new Error(body.error || t.error);
      setCredential({
        name: candidate.name,
        email: body.email || candidate.email || "",
        password: body.temporaryPassword || null,
        state: body.credentialState || "existing_account"
      });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.error);
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
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || t.error);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.error);
    } finally {
      setBusy(null);
    }
  }

  async function issue(candidate: PortalAccessCandidate) {
    setBusy(`code:${candidate.kind}:${candidate.personId}`);
    setError(null);
    setIssued(null);
    try {
      const response = await fetch("/api/portals/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId: candidate.personId, linkType: candidate.kind, expiresInDays: 7 })
      });
      const body = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : t.error);
      setIssued({ name: candidate.name, code: String(body.code ?? ""), claimPath: String(body.claimPath ?? "") });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.error);
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
      const result = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : t.error);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flow-stack">
      {error ? <div className="notice notice-danger" role="alert">{error}</div> : null}

      {credential ? (
        <section className="professional-card">
          <div className="section-heading">
            <div>
              <p className="state-kicker">{t.shareOnce}</p>
              <h2>{credential.name} · {t.portalLogin}</h2>
              <p>{credential.email}</p>
            </div>
            <button className="action-button" type="button" onClick={() => setCredential(null)}>{t.done}</button>
          </div>
          {credential.password ? (
            <>
              <p>{t.tempPassword}</p>
              <div className="code-block"><strong>{credential.password}</strong></div>
              <button className="action-button" type="button" onClick={() => void navigator.clipboard?.writeText(credential.password || "")}>{t.copyPassword}</button>
            </>
          ) : <p>{t.existing}</p>}
        </section>
      ) : null}

      {issued ? (
        <section className="professional-card">
          <div className="section-heading">
            <div><p className="state-kicker">{t.fallback}</p><h2>{issued.name}</h2></div>
            <button className="action-button" type="button" onClick={() => setIssued(null)}>{t.done}</button>
          </div>
          <p>{t.claimBody}</p>
          <div className="code-block"><strong>{issued.code}</strong></div>
          <p><code>{issued.claimPath}</code></p>
        </section>
      ) : null}

      <section className="professional-card">
        <div className="section-heading">
          <div>
            <p className="state-kicker">{t.access}</p>
            <h2>{t.accounts}</h2>
            <p>{t.accountsBody}</p>
          </div>
          <span className="status-pill">{center.parents.length + center.teachers.length} {t.eligible}</span>
        </div>
        <div className="quick-actions" role="tablist">
          <button className={`action-button ${tab === "parents" ? "action-button-primary" : ""}`} type="button" role="tab" aria-selected={tab === "parents"} onClick={() => setTab("parents")}>{t.parents} · {center.parents.length}</button>
          <button className={`action-button ${tab === "teachers" ? "action-button-primary" : ""}`} type="button" role="tab" aria-selected={tab === "teachers"} onClick={() => setTab("teachers")}>{t.teachers} · {center.teachers.length}</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead><tr><th>{t.name}</th><th>{t.email}</th><th>{t.linked}</th><th>{t.account}</th><th>{t.lastLogin}</th><th>{t.actions}</th></tr></thead>
            <tbody>
              {list.map((candidate) => (
                <tr key={`${candidate.kind}:${candidate.personId}`}>
                  <td><strong>{candidate.name}</strong>{candidate.reference ? <><br /><small>{candidate.reference}</small></> : null}</td>
                  <td>{candidate.email || <span className="status-pill">{t.emailRequired}</span>}</td>
                  <td>{scopeLabel(candidate, locale)}</td>
                  <td>{statusLabel(candidate.accountStatus, locale)}</td>
                  <td>{candidate.lastLogin ? new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(candidate.lastLogin)) : t.never}</td>
                  <td>
                    <div className="quick-actions">
                      {candidate.accountStatus === "not_created" ? (
                        <button className="action-button action-button-primary" disabled={busy !== null || !candidate.email} onClick={() => void credentials(candidate, "provision")}>
                          {busy === `provision:${candidate.kind}:${candidate.personId}` ? t.creating : t.createLogin}
                        </button>
                      ) : null}
                      {candidate.accountStatus === "active" && candidate.erpManaged ? (
                        <button className="action-button" disabled={busy !== null} onClick={() => void credentials(candidate, "reset")}>
                          {busy === `reset:${candidate.kind}:${candidate.personId}` ? t.resetting : t.resetPassword}
                        </button>
                      ) : null}
                      {candidate.accountStatus === "active" ? <button className="action-button" disabled={busy !== null} onClick={() => void access(candidate, false)}>{t.disable}</button> : null}
                      {candidate.accountStatus === "disabled" ? <button className="action-button action-button-primary" disabled={busy !== null} onClick={() => void access(candidate, true)}>{t.enable}</button> : null}
                      {candidate.accountStatus === "disabled" && candidate.erpManaged ? <button className="action-button" disabled={busy !== null} onClick={() => void credentials(candidate, "reset")}>{t.resetPassword}</button> : null}
                      {candidate.accountStatus !== "active" ? <button className="action-button" disabled={busy !== null} onClick={() => void issue(candidate)}>{t.claimCode}</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 ? <p>{t.noneEligible}</p> : null}
      </section>

      <section className="professional-card">
        <p className="state-kicker">{t.communication}</p>
        <h2>{t.publishNotice}</h2>
        <form action={publish} className="flow-form">
          <label className="field-label">
            {t.audience}
            <select name="audienceType" className="text-field" defaultValue="tenant">
              <option value="tenant">{t.everyone}</option>
              <option value="parents">{t.guardians}</option>
              <option value="employees">{t.employees}</option>
            </select>
          </label>
          <label className="field-label">
            {t.priority}
            <select name="priority" className="text-field" defaultValue="normal">
              <option value="normal">{t.normal}</option><option value="important">{t.important}</option><option value="urgent">{t.urgent}</option>
            </select>
          </label>
          <label className="field-label">{t.title}<input name="title" className="text-field" required minLength={2} maxLength={160} /></label>
          <label className="field-label">{t.message}<textarea name="body" className="text-field" required minLength={2} maxLength={4000} rows={5} /></label>
          <button className="action-button action-button-primary" disabled={busy !== null} type="submit">{busy === "notice" ? t.publishing : t.publish}</button>
        </form>
      </section>

      <section className="professional-card">
        <div className="section-heading"><div><p className="state-kicker">{t.history}</p><h2>{t.recentCodes}</h2></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t.person}</th><th>{t.type}</th><th>{t.state}</th><th>{t.expires}</th></tr></thead>
            <tbody>
              {center.accessCodes.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.linkType === "guardian" ? t.parent : t.teacher}</td>
                  <td>{item.state}</td>
                  <td>{new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium" }).format(new Date(item.expiresAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

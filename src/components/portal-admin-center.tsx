"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PortalAccessCandidate, PortalOperatorCenter } from "@/lib/portal/runtime";
import type { SupportedLocale } from "@/lib/i18n/config";

type Props = {
  center: PortalOperatorCenter;
  initialTab?: "parents" | "teachers";
  locale?: SupportedLocale;
};

type Credential = { name: string; email: string; password: string | null; state: string };

const raw = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const text = (v: unknown) => (typeof v === "string" ? v : "");

const copy = {
  en: {
    genericError: "Unable to update portal access.",
    credentialsError: "Unable to manage portal credentials.",
    issueError: "Unable to issue access code.",
    noticeError: "Unable to publish notice.",
    noLinkedChild: "No linked child/class",
    noAssignedClass: "No assigned class",
    active: "Active",
    disabled: "Disabled",
    emailRequired: "Email required",
    notCreated: "Not created",
    shareOnce: "Share once",
    portalLogin: "portal login",
    done: "Done",
    tempPassword: "This temporary password is shown only in this response. The user must change it on first login.",
    copyPassword: "Copy password",
    existingLinked: "Existing login linked safely. Its password was not changed.",
    fallbackCode: "Fallback claim code",
    fallbackBody: "This one-time code is for the existing claim-code flow; it does not reveal or store a password.",
    title: "Parent & Teacher Access",
    accounts: "Portal accounts",
    accountsBody: "Create or link logins, reset ERP-managed passwords, and disable only this institution's access.",
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
    issueCode: "Issue claim code",
    noEligibleParents: "No eligible parents found for this branch.",
    noEligibleTeachers: "No eligible teachers found for this branch.",
    communication: "Portal communication",
    publish: "Publish a notice",
    audience: "Audience",
    everyone: "Everyone with portal access",
    parentsAudience: "Parents / guardians",
    teachersAudience: "Teachers / employees",
    priority: "Priority",
    normal: "Normal",
    important: "Important",
    urgent: "Urgent",
    noticeTitle: "Title",
    message: "Message",
    publishing: "Publishing…",
    publishButton: "Publish notice",
    history: "History",
    recentCodes: "Recent claim codes",
    person: "Person",
    type: "Type",
    state: "State",
    expires: "Expires"
  },
  ur: {
    genericError: "پورٹل رسائی اپ ڈیٹ نہیں ہو سکی۔",
    credentialsError: "پورٹل لاگ اِن کا انتظام نہیں ہو سکا۔",
    issueError: "رسائی کوڈ جاری نہیں ہو سکا۔",
    noticeError: "اطلاع شائع نہیں ہو سکی۔",
    noLinkedChild: "کوئی منسلک بچہ یا کلاس نہیں",
    noAssignedClass: "کوئی مقرر کلاس نہیں",
    active: "فعال",
    disabled: "غیر فعال",
    emailRequired: "ای میل درکار",
    notCreated: "ابھی نہیں بنایا گیا",
    shareOnce: "صرف ایک بار شیئر کریں",
    portalLogin: "پورٹل لاگ اِن",
    done: "مکمل",
    tempPassword: "یہ عارضی پاس ورڈ صرف اسی جواب میں دکھایا جا رہا ہے۔ صارف کو پہلی لاگ اِن پر اسے تبدیل کرنا ہوگا۔",
    copyPassword: "پاس ورڈ کاپی کریں",
    existingLinked: "موجودہ لاگ اِن محفوظ طریقے سے منسلک ہو گیا۔ اس کا پاس ورڈ تبدیل نہیں کیا گیا۔",
    fallbackCode: "متبادل کلیم کوڈ",
    fallbackBody: "یہ ایک بار استعمال ہونے والا کوڈ موجودہ کلیم کوڈ فلو کے لیے ہے؛ یہ پاس ورڈ ظاہر یا محفوظ نہیں کرتا۔",
    title: "والدین اور اساتذہ رسائی",
    accounts: "پورٹل اکاؤنٹس",
    accountsBody: "لاگ اِن بنائیں یا منسلک کریں، ERP کے زیر انتظام پاس ورڈ ری سیٹ کریں، اور صرف اسی ادارے کی رسائی بند کریں۔",
    eligible: "اہل",
    parents: "والدین",
    teachers: "اساتذہ",
    name: "نام",
    email: "ای میل",
    linked: "منسلک بچہ / کلاسیں",
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
    issueCode: "کلیم کوڈ جاری کریں",
    noEligibleParents: "اس برانچ کے لیے کوئی اہل والدین نہیں ملے۔",
    noEligibleTeachers: "اس برانچ کے لیے کوئی اہل استاد نہیں ملا۔",
    communication: "پورٹل ابلاغ",
    publish: "اطلاع شائع کریں",
    audience: "سامعین",
    everyone: "تمام پورٹل صارفین",
    parentsAudience: "والدین / سرپرست",
    teachersAudience: "اساتذہ / ملازمین",
    priority: "اہمیت",
    normal: "معمول",
    important: "اہم",
    urgent: "فوری",
    noticeTitle: "عنوان",
    message: "پیغام",
    publishing: "شائع ہو رہا ہے…",
    publishButton: "اطلاع شائع کریں",
    history: "ریکارڈ",
    recentCodes: "حالیہ کلیم کوڈز",
    person: "شخص",
    type: "قسم",
    state: "حالت",
    expires: "میعاد"
  }
} as const;

function scopeLabel(candidate: PortalAccessCandidate, locale: SupportedLocale) {
  const t = copy[locale];
  if (!candidate.linkedScope.length) {
    return candidate.kind === "guardian" ? t.noLinkedChild : t.noAssignedClass;
  }

  return candidate.linkedScope
    .map((item) => {
      const r = raw(item);
      const labels = raw(r.group_labels);
      const group = text(labels[locale]) || text(labels.en) || text(labels.ur);
      return candidate.kind === "guardian"
        ? `${text(r.name) || text(r.student_number) || (locale === "ur" ? "طالب علم" : "Student")}${group ? ` · ${group}` : ""}`
        : group || `${locale === "ur" ? "کلاس" : "Group"} ${String(r.group_id ?? "")}`;
    })
    .join("; ");
}

function statusLabel(status: PortalAccessCandidate["accountStatus"], locale: SupportedLocale) {
  const t = copy[locale];
  return status === "active"
    ? t.active
    : status === "disabled"
      ? t.disabled
      : status === "email_required"
        ? t.emailRequired
        : t.notCreated;
}

export function PortalAdminCenter({
  center,
  initialTab = "parents",
  locale = "en"
}: Props) {
  const t = copy[locale];
  const router = useRouter();
  const [tab, setTab] = useState<"parents" | "teachers">(initialTab);
  const [busy, setBusy] = useState<string | null>(null);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [issued, setIssued] = useState<{ name: string; code: string; claimPath: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = tab === "parents" ? center.parents : center.teachers;
  const dateLocale = locale === "ur" ? "ur-PK" : "en-IN";

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
      const body = (await response.json()) as {
        error?: string;
        email?: string;
        temporaryPassword?: string;
        credentialState?: string;
      };
      if (!response.ok) throw new Error(body.error || t.credentialsError);
      setCredential({
        name: candidate.name,
        email: body.email || candidate.email || "",
        password: body.temporaryPassword || null,
        state: body.credentialState || "existing_account"
      });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.credentialsError);
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
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || t.genericError);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.genericError);
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
      const body = (await response.json()) as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : t.issueError);
      setIssued({
        name: candidate.name,
        code: String(body.code ?? ""),
        claimPath: String(body.claimPath ?? "")
      });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.issueError);
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
      const result = (await response.json()) as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : t.noticeError);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.noticeError);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flow-stack" lang={locale} dir={locale === "ur" ? "rtl" : "ltr"}>
      {error ? <div className="notice notice-danger" role="alert">{error}</div> : null}

      {credential ? (
        <section className="professional-card">
          <div className="section-heading">
            <div>
              <p className="state-kicker">{t.shareOnce}</p>
              <h2>{credential.name} {t.portalLogin}</h2>
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
          ) : <p>{t.existingLinked}</p>}
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
          <p><code>{issued.claimPath}</code></p>
        </section>
      ) : null}

      <section className="professional-card">
        <div className="section-heading">
          <div>
            <p className="state-kicker">{t.title}</p>
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
                  <td>{candidate.lastLogin ? new Date(candidate.lastLogin).toLocaleString(dateLocale) : t.never}</td>
                  <td>
                    <div className="quick-actions">
                      {candidate.accountStatus === "not_created" ? (
                        <button className="action-button action-button-primary" type="button" disabled={busy !== null || !candidate.email} onClick={() => void credentials(candidate, "provision")}>
                          {busy === `provision:${candidate.kind}:${candidate.personId}` ? t.creating : t.createLogin}
                        </button>
                      ) : null}
                      {candidate.accountStatus === "active" && candidate.erpManaged ? (
                        <button className="action-button" type="button" disabled={busy !== null} onClick={() => void credentials(candidate, "reset")}>
                          {busy === `reset:${candidate.kind}:${candidate.personId}` ? t.resetting : t.resetPassword}
                        </button>
                      ) : null}
                      {candidate.accountStatus === "active" ? <button className="action-button" type="button" disabled={busy !== null} onClick={() => void access(candidate, false)}>{t.disable}</button> : null}
                      {candidate.accountStatus === "disabled" ? <button className="action-button action-button-primary" type="button" disabled={busy !== null} onClick={() => void access(candidate, true)}>{t.enable}</button> : null}
                      {candidate.accountStatus === "disabled" && candidate.erpManaged ? <button className="action-button" type="button" disabled={busy !== null} onClick={() => void credentials(candidate, "reset")}>{t.resetPassword}</button> : null}
                      {candidate.accountStatus !== "active" ? <button className="action-button" type="button" disabled={busy !== null} onClick={() => void issue(candidate)}>{t.issueCode}</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 ? <p>{tab === "parents" ? t.noEligibleParents : t.noEligibleTeachers}</p> : null}
      </section>

      <section className="professional-card">
        <p className="state-kicker">{t.communication}</p>
        <h2>{t.publish}</h2>
        <form action={publish} className="flow-form">
          <label className="field-label">{t.audience}
            <select name="audienceType" className="text-field" defaultValue="tenant">
              <option value="tenant">{t.everyone}</option>
              <option value="parents">{t.parentsAudience}</option>
              <option value="employees">{t.teachersAudience}</option>
            </select>
          </label>
          <label className="field-label">{t.priority}
            <select name="priority" className="text-field" defaultValue="normal">
              <option value="normal">{t.normal}</option>
              <option value="important">{t.important}</option>
              <option value="urgent">{t.urgent}</option>
            </select>
          </label>
          <label className="field-label">{t.noticeTitle}<input name="title" className="text-field" required minLength={2} maxLength={160} /></label>
          <label className="field-label">{t.message}<textarea name="body" className="text-field" required minLength={2} maxLength={4000} rows={5} /></label>
          <button className="action-button action-button-primary" disabled={busy !== null} type="submit">{busy === "notice" ? t.publishing : t.publishButton}</button>
        </form>
      </section>

      <section className="professional-card">
        <div className="section-heading"><div><p className="state-kicker">{t.history}</p><h2>{t.recentCodes}</h2></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t.person}</th><th>{t.type}</th><th>{t.state}</th><th>{t.expires}</th></tr></thead>
            <tbody>{center.accessCodes.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.linkType}</td><td>{item.state}</td><td>{new Date(item.expiresAt).toLocaleDateString(dateLocale)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

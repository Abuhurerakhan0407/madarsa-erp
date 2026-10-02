"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/lib/i18n/config";
import type { PortalAccessCandidate, PortalOperatorCenter } from "@/lib/portal/runtime";

type Props = {
  center: PortalOperatorCenter;
  initialTab: "parents" | "teachers";
  locale: SupportedLocale;
};

type Handoff = {
  name: string;
  email: string;
  password: string | null;
  state: string;
  auditWarning?: string;
};

type Raw = Record<string, unknown>;
const raw = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const value = (input: unknown) => typeof input === "string" ? input : "";

const copy = {
  en: {
    title: "Create portal access",
    body: "Choose a parent or teacher, confirm their saved email, then set a temporary password for first sign-in.",
    parents: "Parent",
    teachers: "Teacher / Staff",
    choose: "Choose person",
    choosePlaceholder: "Select a person",
    savedEmail: "Email address",
    confirmEmail: "Confirm email",
    temporaryPassword: "Temporary password",
    confirmPassword: "Confirm temporary password",
    showPassword: "Show password",
    passwordRule: "Use 12+ characters with uppercase, lowercase, number, and symbol.",
    scope: "Linked access",
    account: "Account status",
    create: "Create access",
    creating: "Creating…",
    reset: "Reset password",
    resetting: "Resetting…",
    disable: "Disable access",
    disabling: "Disabling…",
    enable: "Enable access",
    enabling: "Enabling…",
    active: "Active",
    disabled: "Disabled",

    notCreated: "Not created",
    emailRequired: "Email required",
    noScope: "No linked child or assigned class",
    emailMissing: "Add an email to this person's profile before creating access.",
    existingManagedElsewhere: "This existing login keeps its current password; Ilmgaah will not overwrite it.",
    handoffTitle: "Access ready",
    handoffBody: "Share these details once. The temporary password disappears when you close this card.",
    noPasswordBody: "Existing verified login linked. No password was changed.",
    copy: "Copy credentials",
    copied: "Copied",
    share: "Share",
    done: "Done",
    emailMismatch: "Email entries do not match.",
    passwordMismatch: "Password entries do not match.",
    passwordInvalid: "Password does not meet the required policy.",
    createError: "Unable to create portal access.",
    updateError: "Unable to update portal access.",
    resetConfirm: "Reset this person's portal password? Their current password will stop working.",
    disableConfirm: "Disable this person's portal access now?"
  },
  ur: {
    title: "پورٹل رسائی بنائیں",
    body: "والدین یا استاد منتخب کریں، محفوظ ای میل کی تصدیق کریں، پھر پہلی لاگ اِن کے لیے عارضی پاس ورڈ مقرر کریں۔",
    parents: "والدین",
    teachers: "استاد / عملہ",

    choose: "فرد منتخب کریں",
    choosePlaceholder: "ایک فرد منتخب کریں",
    savedEmail: "ای میل پتہ",
    confirmEmail: "ای میل کی تصدیق",
    temporaryPassword: "عارضی پاس ورڈ",
    confirmPassword: "عارضی پاس ورڈ کی تصدیق",
    showPassword: "پاس ورڈ دکھائیں",
    passwordRule: "کم از کم 12 حروف، بڑے اور چھوٹے حروف، عدد اور علامت استعمال کریں۔",
    scope: "منسلک رسائی",
    account: "اکاؤنٹ کی حالت",
    create: "رسائی بنائیں",
    creating: "رسائی بن رہی ہے…",
    reset: "پاس ورڈ ری سیٹ کریں",
    resetting: "ری سیٹ ہو رہا ہے…",
    disable: "رسائی بند کریں",
    disabling: "رسائی بند ہو رہی ہے…",
    enable: "رسائی فعال کریں",
    enabling: "رسائی فعال ہو رہی ہے…",
    active: "فعال",
    disabled: "غیر فعال",
    notCreated: "ابھی نہیں بنا",
    emailRequired: "ای میل درکار ہے",
    noScope: "کوئی طالب علم یا مقررہ کلاس منسلک نہیں",
    emailMissing: "رسائی بنانے سے پہلے اس فرد کے پروفائل میں ای میل شامل کریں۔",

    existingManagedElsewhere: "موجودہ لاگ اِن اپنا موجودہ پاس ورڈ استعمال کرے گا؛ علمگاہ اسے تبدیل نہیں کرے گا۔",
    handoffTitle: "رسائی تیار ہے",
    handoffBody: "یہ تفصیل صرف ایک بار شیئر کریں۔ کارڈ بند کرنے کے بعد عارضی پاس ورڈ غائب ہو جائے گا۔",
    noPasswordBody: "موجودہ تصدیق شدہ لاگ اِن منسلک ہو گیا۔ پاس ورڈ تبدیل نہیں کیا گیا۔",
    copy: "لاگ اِن تفصیل کاپی کریں",
    copied: "کاپی ہو گیا",
    share: "شیئر کریں",
    done: "مکمل",
    emailMismatch: "دونوں ای میل ایک جیسی نہیں ہیں۔",
    passwordMismatch: "دونوں پاس ورڈ ایک جیسے نہیں ہیں۔",
    passwordInvalid: "پاس ورڈ مطلوبہ اصول پورے نہیں کرتا۔",
    createError: "پورٹل رسائی نہیں بن سکی۔",
    updateError: "پورٹل رسائی تبدیل نہیں ہو سکی۔",
    resetConfirm: "اس فرد کا پورٹل پاس ورڈ ری سیٹ کریں؟ موجودہ پاس ورڈ کام کرنا بند کر دے گا۔",
    disableConfirm: "کیا اس فرد کی پورٹل رسائی ابھی بند کرنی ہے؟"
  }
} as const;

function groupLabel(labels: unknown, locale: SupportedLocale) {
  const labelsRow = raw(labels);
  return value(labelsRow[locale]) || value(labelsRow.en);
}

function scopeLabel(candidate: PortalAccessCandidate, locale: SupportedLocale) {
  const t = copy[locale];
  if (!candidate.linkedScope.length) return t.noScope;
  return candidate.linkedScope.map((item) => {
    const row = raw(item);
    const group = groupLabel(row.group_labels, locale);
    if (candidate.kind === "guardian") {
      const student = value(row.name) || value(row.student_number) || "Student";
      return group ? `${student} · ${group}` : student;
    }
    return group || `Group ${String(row.group_id ?? "")}`;
  }).join("; ");
}

function statusLabel(candidate: PortalAccessCandidate, locale: SupportedLocale) {
  const t = copy[locale];
  if (candidate.accountStatus === "active") return t.active;
  if (candidate.accountStatus === "disabled") return t.disabled;
  if (candidate.accountStatus === "email_required") return t.emailRequired;
  return t.notCreated;
}

function validPassword(password: string) {
  return password.length >= 12
    && password.length <= 128

    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /[0-9]/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

export function PortalCredentialManager({ center, initialTab, locale }: Props) {
  const router = useRouter();
  const t = copy[locale];
  const [tab, setTab] = useState<"parents" | "teachers">(initialTab);
  const [personId, setPersonId] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const lock = useRef(false);

  const list = tab === "parents" ? center.parents : center.teachers;
  const selected = personId ? list.find((candidate) => candidate.personId === personId) ?? null : null;

  function changeTab(next: "parents" | "teachers") {
    if (busy) return;
    setTab(next);
    setPersonId(null);

    setError(null);
    setHandoff(null);
    setCopied(false);
  }

  async function setAccess(candidate: PortalAccessCandidate, enabled: boolean) {
    if (lock.current) return;
    if (!enabled && !window.confirm(t.disableConfirm)) return;
    lock.current = true;
    const key = `access:${candidate.kind}:${candidate.personId}`;
    setBusy(key);
    setError(null);
    try {
      const response = await fetch("/api/portals/access-state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId: candidate.personId, kind: candidate.kind, enabled })
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || t.updateError);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.updateError);
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || lock.current) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const confirmEmail = String(data.get("confirmEmail") ?? "").trim().toLowerCase();
    const temporaryPassword = String(data.get("temporaryPassword") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");

    if (email !== confirmEmail) {
      setError(t.emailMismatch);
      return;
    }
    if (temporaryPassword !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }
    if (!validPassword(temporaryPassword)) {
      setError(t.passwordInvalid);
      return;
    }

    const action = selected.accountStatus === "active" || selected.accountStatus === "disabled" ? "reset" : "provision";

    if (action === "reset" && !window.confirm(t.resetConfirm)) return;

    lock.current = true;
    const key = `${action}:${selected.kind}:${selected.personId}`;
    setBusy(key);
    setError(null);
    setHandoff(null);
    setCopied(false);

    try {
      const response = await fetch("/api/portals/credentials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          personId: selected.personId,
          kind: selected.kind,
          action,
          email,
          confirmEmail,
          temporaryPassword
        })
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        email?: string;
        temporaryPassword?: string;
        credentialState?: string;
        auditWarning?: string;
      };

      if (!response.ok) throw new Error(payload.error || t.createError);

      setHandoff({
        name: selected.name,
        email: payload.email || email,
        password: payload.temporaryPassword || null,
        state: payload.credentialState || "existing_account",
        auditWarning: payload.auditWarning
      });
      form.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.createError);
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  async function copyHandoff() {
    if (!handoff) return;
    const lines = [`${t.savedEmail}: ${handoff.email}`];
    if (handoff.password) lines.push(`${t.temporaryPassword}: ${handoff.password}`);
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
  }

  async function shareHandoff() {
    if (!handoff) return;
    const lines = [`${t.savedEmail}: ${handoff.email}`];
    if (handoff.password) lines.push(`${t.temporaryPassword}: ${handoff.password}`);
    if ("share" in navigator) {
      await navigator.share({ title: t.handoffTitle, text: lines.join("\n") });
      return;
    }
    await copyHandoff();
  }

  return (
    <div className="flow-stack portal-access-manager">
      {error ? <div className="notice notice-danger" role="alert">{error}</div> : null}

      {handoff ? (
        <section className="professional-card portal-handoff-card" aria-live="polite">
          <div className="section-heading">
            <div>
              <p className="state-kicker">{t.handoffTitle}</p>
              <h2>{handoff.name}</h2>
              <p>{handoff.password ? t.handoffBody : t.noPasswordBody}</p>
            </div>
            <button className="action-button" type="button" onClick={() => { setHandoff(null); setCopied(false); }}>
              {t.done}
            </button>
          </div>

          <div className="portal-handoff-grid">
            <div><span>{t.savedEmail}</span><strong>{handoff.email}</strong></div>
            {handoff.password ? <div><span>{t.temporaryPassword}</span><strong className="code-block">{handoff.password}</strong></div> : null}
          </div>
          {handoff.auditWarning ? <p className="form-message form-error">{handoff.auditWarning}</p> : null}
          <div className="quick-actions">
            <button className="action-button action-button-primary" type="button" onClick={() => void copyHandoff()}>
              {copied ? t.copied : t.copy}
            </button>
            <button className="action-button" type="button" onClick={() => void shareHandoff()}>{t.share}</button>
          </div>
        </section>
      ) : null}

      <section className="professional-card">
        <div className="section-heading">
          <div><p className="state-kicker">{t.title}</p><h2>{t.title}</h2><p>{t.body}</p></div>
        </div>
        <div className="quick-actions portal-type-tabs" role="tablist">

          <button
            className={`action-button ${tab === "parents" ? "action-button-primary" : ""}`}
            type="button"
            role="tab"
            aria-selected={tab === "parents"}
            onClick={() => changeTab("parents")}
          >
            {t.parents} · {center.parents.length}
          </button>
          <button
            className={`action-button ${tab === "teachers" ? "action-button-primary" : ""}`}
            type="button"
            role="tab"
            aria-selected={tab === "teachers"}
            onClick={() => changeTab("teachers")}
          >
            {t.teachers} · {center.teachers.length}
          </button>
        </div>

        <label className="field-label portal-person-select">
          {t.choose}
          <select className="text-field" value={personId ?? ""} disabled={busy !== null} onChange={(event) => {
            setPersonId(event.target.value ? Number(event.target.value) : null);
            setError(null);
          }}>

            <option value="">{t.choosePlaceholder}</option>
            {list.map((candidate) => (
              <option key={candidate.personId} value={candidate.personId}>
                {candidate.name}{candidate.reference ? ` · ${candidate.reference}` : ""}
              </option>
            ))}
          </select>
        </label>

        {selected ? (
          <div className="portal-access-detail">
            <div className="portal-access-preview">
              <div><span>{t.account}</span><strong>{statusLabel(selected, locale)}</strong></div>
              <div><span>{t.scope}</span><strong>{scopeLabel(selected, locale)}</strong></div>
            </div>

            {selected.accountStatus === "active" || selected.accountStatus === "disabled" ? (
              <div className="quick-actions">
                <button
                  className="action-button"
                  type="button"
                  disabled={busy !== null}
                  aria-busy={busy?.startsWith("access:") || undefined}

                  onClick={() => void setAccess(selected, selected.accountStatus === "disabled")}
                >
                  {selected.accountStatus === "disabled"
                    ? (busy?.startsWith("access:") ? t.enabling : t.enable)
                    : (busy?.startsWith("access:") ? t.disabling : t.disable)}
                </button>
              </div>
            ) : null}

            {!selected.email ? <p className="form-message form-error">{t.emailMissing}</p> : null}
            {selected.accountStatus !== "not_created" && !selected.erpManaged ? (
              <p className="form-message">{t.existingManagedElsewhere}</p>
            ) : null}

            <PortalCredentialForm
              key={`${selected.kind}:${selected.personId}:${selected.accountStatus}:${selected.email ?? ""}`}
              candidate={selected}
              locale={locale}
              busy={busy}
              onSubmit={submit}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function PortalCredentialForm({
  candidate,
  locale,
  busy,
  onSubmit
}: {
  candidate: PortalAccessCandidate;
  locale: SupportedLocale;
  busy: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const t = copy[locale];
  const [showPassword, setShowPassword] = useState(false);
  const action = candidate.accountStatus === "active" || candidate.accountStatus === "disabled" ? "reset" : "provision";
  const canSubmit = Boolean(candidate.email)
    && !(action === "reset" && !candidate.erpManaged)
    && busy === null;

  return (
    <form className="portal-credential-form" onSubmit={onSubmit} aria-busy={busy !== null || undefined}>
      <div className="portal-credential-grid">
        <label className="field-label">
          {t.savedEmail}
          <input
            className="text-field"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={candidate.email ?? ""}
            required
            disabled={busy !== null}
          />
        </label>
        <label className="field-label">
          {t.confirmEmail}
          <input
            className="text-field"
            name="confirmEmail"
            type="email"
            autoComplete="off"
            defaultValue=""
            required
            disabled={busy !== null}
          />
        </label>
        <label className="field-label">
          {t.temporaryPassword}
          <input
            className="text-field"
            name="temporaryPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            disabled={!candidate.email || (action === "reset" && !candidate.erpManaged) || busy !== null}
          />
        </label>
        <label className="field-label">
          {t.confirmPassword}
          <input
            className="text-field"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            disabled={!candidate.email || (action === "reset" && !candidate.erpManaged) || busy !== null}
          />
        </label>
      </div>
      <label className="portal-password-toggle">
        <input
          type="checkbox"
          checked={showPassword}
          onChange={(event) => setShowPassword(event.target.checked)}
          disabled={busy !== null}
        />
        <span>{t.showPassword}</span>
      </label>

      <p className="portal-password-rule">{t.passwordRule}</p>
      <button
        className="action-button action-button-primary"
        type="submit"
        disabled={!canSubmit}
      >
        {action === "provision"
          ? (busy?.startsWith("provision:") ? t.creating : t.create)
          : (busy?.startsWith("reset:") ? t.resetting : t.reset)}
      </button>
    </form>
  );
}

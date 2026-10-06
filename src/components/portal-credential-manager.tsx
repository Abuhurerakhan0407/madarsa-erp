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
  username: string | null;
  email: string | null;
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
    body: "Choose a parent or teacher, then create or manage username credentials. Generated passwords appear once.",
    parents: "Parent",
    teachers: "Teacher / Staff",
    choose: "Choose person",
    choosePlaceholder: "Select a person",
    savedEmail: "Email address",
    confirmEmail: "Confirm email",
    temporaryPassword: "Temporary password",
    confirmPassword: "Confirm temporary password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    username: "Username",
    createWithoutEmail: "Create login without email",
    createWithoutEmailBusy: "Creating username login…",
    usernameReset: "Reset username password",
    bulkTitle: "Bulk parent login handout",
    bulkBody: "Create username logins for guardians linked to one class. New passwords appear only in this print view.",
    class: "Class",
    selectClass: "Select a class",
    selectAll: "Select all new logins",
    clear: "Clear",
    generateLogins: "Generate logins for this class/guardians",
    generatingLogins: "Generating…",
    noNewLogins: "No guardians in this class need a new username login.",
    bulkComplete: "Created {created} login(s). Skipped: {skipped}.",
    student: "Student",
    father: "Father",
    portalUrl: "Portal URL",
    printTitle: "Ilmgaah Parent Portal Login",
    printHelp: "Keep this slip private. Change the temporary password after first sign-in.",
    print: "Print",
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
    body: "والدین یا استاد منتخب کریں، پھر یوزرنیم رسائی بنائیں یا منظم کریں۔ تیار شدہ پاس ورڈ صرف ایک بار دکھے گا۔",
    parents: "والدین",
    teachers: "استاد / عملہ",

    choose: "فرد منتخب کریں",
    choosePlaceholder: "ایک فرد منتخب کریں",
    savedEmail: "ای میل پتہ",
    confirmEmail: "ای میل کی تصدیق",
    temporaryPassword: "عارضی پاس ورڈ",
    confirmPassword: "عارضی پاس ورڈ کی تصدیق",
    showPassword: "پاس ورڈ دکھائیں",
    hidePassword: "پاس ورڈ چھپائیں",
    username: "یوزرنیم",
    createWithoutEmail: "ای میل کے بغیر لاگ اِن بنائیں",
    createWithoutEmailBusy: "یوزرنیم لاگ اِن بن رہا ہے…",
    usernameReset: "یوزرنیم پاس ورڈ ری سیٹ کریں",
    bulkTitle: "والدین کے بلک لاگ اِن",
    bulkBody: "ایک کلاس کے سرپرستوں کے لیے یوزرنیم لاگ اِن بنائیں۔ نئے پاس ورڈ صرف پرنٹ ویو میں دکھیں گے۔",
    class: "کلاس",
    selectClass: "ایک کلاس منتخب کریں",
    selectAll: "تمام نئے لاگ اِن منتخب کریں",
    clear: "صاف کریں",
    generateLogins: "اس کلاس/سرپرستوں کے لاگ اِن بنائیں",
    generatingLogins: "بنائے جا رہے ہیں…",
    noNewLogins: "اس کلاس میں نیا یوزرنیم لاگ اِن درکار نہیں۔",
    bulkComplete: "{created} لاگ اِن بنائے گئے۔ چھوڑے گئے: {skipped}۔",
    student: "طالب علم",
    father: "والد",
    portalUrl: "پورٹل URL",
    printTitle: "علمگاہ والدین پورٹل لاگ اِن",
    printHelp: "اس پرچی کو محفوظ رکھیں۔ پہلی لاگ اِن کے بعد عارضی پاس ورڈ تبدیل کریں۔",
    print: "پرنٹ",
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


function escapeHtml(input: string) {
  return input.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char] ?? char));
}

function scopeChildren(candidate: PortalAccessCandidate, groupId: number) {
  return candidate.linkedScope.filter((item) => Number(raw(item).group_id) === groupId);
}

export function PortalCredentialManager({ center, initialTab, locale }: Props) {
  const router = useRouter();
  const t = copy[locale];
  const [tab, setTab] = useState<"parents" | "teachers">(initialTab);
  const [personId, setPersonId] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [showHandoffPassword, setShowHandoffPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedBulkGuardians, setSelectedBulkGuardians] = useState<Set<number>>(new Set());
  const lock = useRef(false);

  const list = tab === "parents" ? center.parents : center.teachers;
  const selected = personId ? list.find((candidate) => candidate.personId === personId) ?? null : null;

  const classOptions = tab === "parents"
    ? [...new Map(
        center.parents.flatMap((candidate) => candidate.linkedScope.flatMap((item) => {
          const row = raw(item);
          const id = Number(row.group_id);
          if (!Number.isInteger(id) || id <= 0) return [];
          return [[id, groupLabel(row.group_labels, locale) || "Group " + id] as const];
        }))
      ).entries()].sort((a, b) => a[1].localeCompare(b[1]))
    : [];

  const bulkGuardians = selectedClassId === null
    ? []
    : center.parents.filter((candidate) =>
        candidate.accountStatus === "not_created"
        && candidate.linkedScope.some((item) => Number(raw(item).group_id) === selectedClassId)
      );

  function changeTab(next: "parents" | "teachers") {
    if (busy) return;
    setTab(next);
    setPersonId(null);
    setSelectedClassId(null);
    setSelectedBulkGuardians(new Set());

    setError(null);
    setHandoff(null);
    setBulkStatus(null);
    setCopied(false);
  }

  function selectBulkClass(groupId: number | null) {
    setSelectedClassId(groupId);
    setBulkStatus(null);
    const next = new Set<number>();
    if (groupId !== null) {
      for (const candidate of center.parents) {
        if (
          candidate.accountStatus === "not_created"
          && candidate.linkedScope.some((item) => Number(raw(item).group_id) === groupId)
        ) next.add(candidate.personId);
      }
    }
    setSelectedBulkGuardians(next);
    setError(null);
    setBulkStatus(null);
  }

  async function createUsernameLogin(candidate: PortalAccessCandidate) {
    if (lock.current || candidate.accountStatus !== "not_created" || !candidate.portalUsername) return;
    lock.current = true;
    setBusy("username:" + candidate.personId);
    setError(null);
    setHandoff(null);
    setShowHandoffPassword(false);
    setCopied(false);
    try {
      const response = await fetch("/api/portals/credentials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId: candidate.personId, kind: candidate.kind, action: "provision_username" })
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        username?: string;
        temporaryPassword?: string;
        credentialState?: string;
        auditWarning?: string;
      };
      if (!response.ok) throw new Error(payload.error || t.createError);
      setHandoff({
        name: candidate.name,
        username: payload.username || candidate.portalUsername,
        email: null,
        password: payload.temporaryPassword || null,
        state: payload.credentialState || "username_account",
        auditWarning: payload.auditWarning
      });
      setShowHandoffPassword(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.createError);
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  async function resetUsernameLogin(candidate: PortalAccessCandidate) {
    if (lock.current || candidate.loginMethod !== "username" || !candidate.portalUsername) return;
    if (!window.confirm(t.resetConfirm)) return;
    lock.current = true;
    setBusy("username-reset:" + candidate.personId);
    setError(null);
    setHandoff(null);
    setShowHandoffPassword(false);
    setCopied(false);
    try {
      const response = await fetch("/api/portals/credentials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId: candidate.personId, kind: candidate.kind, action: "reset" })
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        username?: string;
        temporaryPassword?: string;
        auditWarning?: string;
      };
      if (!response.ok) throw new Error(payload.error || t.updateError);
      setHandoff({
        name: candidate.name,
        username: payload.username || candidate.portalUsername,
        email: null,
        password: payload.temporaryPassword || null,
        state: "temporary_username_password_reset",
        auditWarning: payload.auditWarning
      });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.updateError);
    } finally {
      lock.current = false;
      setBusy(null);
    }
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


  async function bulkGenerate() {
    if (lock.current || selectedClassId === null) return;
    const ids = [...selectedBulkGuardians].filter((id) => bulkGuardians.some((candidate) => candidate.personId === id));
    if (!ids.length) {
      setError(t.noNewLogins);
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError(t.createError);
      return;
    }

    lock.current = true;
    setBusy("bulk");
    setError(null);

    const slips: Array<{ candidate: PortalAccessCandidate; username: string; password: string }> = [];
    let skipped = 0;

    try {
      for (const id of ids) {
        const candidate = bulkGuardians.find((item) => item.personId === id);
        if (!candidate) {
          skipped++;
          continue;
        }

        try {
          const response = await fetch("/api/portals/credentials", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              personId: candidate.personId,
              kind: "guardian",
              action: "provision_username"
            })
          });
          const payload = await response.json().catch(() => ({})) as {
            username?: string;
            temporaryPassword?: string;
          };
          if (!response.ok || !payload.username || !payload.temporaryPassword) {
            skipped++;
            continue;
          }
          slips.push({
            candidate,
            username: payload.username,
            password: payload.temporaryPassword
          });
        } catch {
          skipped++;
        }
      }

      if (!slips.length) {
        printWindow.close();
        setError(t.noNewLogins);
        return;
      }

      const portalUrl = window.location.origin + "/portal?locale=" + encodeURIComponent(locale);
      const slipsHtml = slips.map(({ candidate, username, password }) => {
        const children = scopeChildren(candidate, selectedClassId);
        const studentNames = [...new Set(children.map((item) => value(raw(item).name)).filter(Boolean))].join(", ") || "—";
        const fatherNames = [...new Set(children.map((item) => value(raw(item).father_name)).filter(Boolean))].join(", ") || "—";
        return "<article class=\"slip\">" +
          "<div class=\"label\">" + escapeHtml(t.student) + "</div><div class=\"value\">" + escapeHtml(studentNames) + "</div>" +
          "<div class=\"label\">" + escapeHtml(t.father) + "</div><div class=\"value\">" + escapeHtml(fatherNames) + "</div>" +
          "<div class=\"label\">" + escapeHtml(t.username) + "</div><div class=\"value code\">" + escapeHtml(username) + "</div>" +
          "<div class=\"label\">" + escapeHtml(t.temporaryPassword) + "</div><div class=\"value code\">" + escapeHtml(password) + "</div>" +
          "<div class=\"label\">" + escapeHtml(t.portalUrl) + "</div><div class=\"value code small\">" + escapeHtml(portalUrl) + "</div>" +
          "</article>";
      }).join("");

      printWindow.document.write(
        "<!doctype html><html lang=\"" + escapeHtml(locale) + "\" dir=\"" + (locale === "ur" ? "rtl" : "ltr") + "\"><head>" +
        "<meta charset=\"utf-8\"><title>" + escapeHtml(t.printTitle) + "</title>" +
        "<style>body{font-family:Arial,sans-serif;margin:24px;background:#f5f6f7;color:#17191b}.sheet{max-width:920px;margin:0 auto}h1{margin:0 0 8px}.intro{line-height:1.5}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}.slip{background:#fff;border:1px solid #d9dde1;border-radius:16px;padding:18px;break-inside:avoid}.label{font-size:12px;opacity:.65;margin-bottom:4px}.value{font-size:17px;font-weight:700;margin-bottom:14px}.code{direction:ltr;text-align:left;unicode-bidi:plaintext;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.small{font-size:12px;overflow-wrap:anywhere}.actions{margin:0 0 18px}@media print{body{background:#fff;margin:0}.actions{display:none}.slip{box-shadow:none}}</style>" +
        "</head><body><main class=\"sheet\"><div class=\"actions\"><button onclick=\"window.print()\">" + escapeHtml(t.print) + "</button></div>" +
        "<h1>" + escapeHtml(t.printTitle) + "</h1><p class=\"intro\">" + escapeHtml(t.printHelp) + "</p>" +
        "<div class=\"grid\">" + slipsHtml + "</div></main></body></html>"
      );
      printWindow.document.close();
      printWindow.focus();
      window.setTimeout(() => printWindow.print(), 250);

      const message = t.bulkComplete.replace("{created}", String(slips.length)).replace("{skipped}", String(skipped));
      setError(null);
      setBulkStatus(message);
      setSelectedBulkGuardians(new Set());
      router.refresh();
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
        username: null,
        email: payload.email || email,
        password: payload.temporaryPassword || null,
        state: payload.credentialState || "existing_account",
        auditWarning: payload.auditWarning
      });
      setShowHandoffPassword(false);
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
    const lines: string[] = [];
    if (handoff.username) lines.push(t.username + ": " + handoff.username);
    if (handoff.email) lines.push(t.savedEmail + ": " + handoff.email);
    if (handoff.password) lines.push(t.temporaryPassword + ": " + handoff.password);
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
  }

  async function shareHandoff() {
    if (!handoff) return;
    const lines: string[] = [];
    if (handoff.username) lines.push(t.username + ": " + handoff.username);
    if (handoff.email) lines.push(t.savedEmail + ": " + handoff.email);
    if (handoff.password) lines.push(t.temporaryPassword + ": " + handoff.password);
    if ("share" in navigator) {
      await navigator.share({ title: t.handoffTitle, text: lines.join("\n") });
      return;
    }
    await copyHandoff();
  }

  return (
    <div className="flow-stack portal-access-manager">
      {error ? <div className="notice notice-danger" role="alert">{error}</div> : null}
      {bulkStatus ? <div className="notice" role="status">{bulkStatus}</div> : null}

      {handoff ? (
        <section className="professional-card portal-handoff-card" aria-live="polite">
          <div className="section-heading">
            <div>
              <p className="state-kicker">{t.handoffTitle}</p>
              <h2>{handoff.name}</h2>
              <p>{handoff.password ? t.handoffBody : t.noPasswordBody}</p>
            </div>
            <button className="action-button" type="button" onClick={() => { setHandoff(null); setShowHandoffPassword(false); setCopied(false); }}>
              {t.done}
            </button>
          </div>

          <div className="portal-handoff-grid">
            {handoff.username ? <div><span>{t.username}</span><strong className="code-block" dir="ltr">{handoff.username}</strong></div> : null}
            {handoff.email ? <div><span>{t.savedEmail}</span><strong dir="ltr">{handoff.email}</strong></div> : null}
            {handoff.password ? (
              <div>
                <span>{t.temporaryPassword}</span>
                <strong className="code-block" dir="ltr">{showHandoffPassword ? handoff.password : "••••••••••••"}</strong>
                <button
                  className="action-button"
                  type="button"
                  onClick={() => setShowHandoffPassword((current) => !current)}
                >
                  {showHandoffPassword ? t.hidePassword : t.showPassword}
                </button>
              </div>
            ) : null}
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

        {tab === "parents" ? (
          <section className="professional-card">
            <div className="section-heading">
              <div><p className="state-kicker">{t.bulkTitle}</p><h3>{t.bulkTitle}</h3><p>{t.bulkBody}</p></div>
            </div>
            <label className="field-label">
              {t.class}
              <select
                className="text-field"
                value={selectedClassId ?? ""}
                disabled={busy !== null}
                onChange={(event) => selectBulkClass(event.target.value ? Number(event.target.value) : null)}
              >
                <option value="">{t.selectClass}</option>
                {classOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            {selectedClassId !== null ? (
              <div className="flow-stack">
                {bulkGuardians.length ? (
                  <>
                    <div className="quick-actions">
                      <button
                        className="action-button"
                        type="button"
                        disabled={busy !== null}
                        onClick={() => setSelectedBulkGuardians(new Set(bulkGuardians.map((candidate) => candidate.personId)))}
                      >
                        {t.selectAll}
                      </button>
                      <button
                        className="action-button"
                        type="button"
                        disabled={busy !== null}
                        onClick={() => setSelectedBulkGuardians(new Set())}
                      >
                        {t.clear}
                      </button>
                    </div>
                    {bulkGuardians.map((candidate) => (
                      <label className="check-row" key={candidate.personId}>
                        <input
                          type="checkbox"
                          checked={selectedBulkGuardians.has(candidate.personId)}
                          disabled={busy !== null}
                          onChange={(event) => setSelectedBulkGuardians((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(candidate.personId);
                            else next.delete(candidate.personId);
                            return next;
                          })}
                        />
                        <span>{candidate.name} · <span dir="ltr">{candidate.portalUsername}</span></span>
                      </label>
                    ))}
                    <button
                      className="action-button action-button-primary"
                      type="button"
                      disabled={busy !== null || !selectedBulkGuardians.size}
                      onClick={() => void bulkGenerate()}
                    >
                      {busy === "bulk" ? t.generatingLogins : t.generateLogins}
                    </button>
                  </>
                ) : <p>{t.noNewLogins}</p>}
              </div>
            ) : null}
          </section>
        ) : null}

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
              {selected.portalUsername ? (
                <div><span>{t.username}</span><strong className="code-block" dir="ltr">{selected.portalUsername}</strong></div>
              ) : null}
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
                {selected.loginMethod === "username" ? (
                  <button
                    className="action-button"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void resetUsernameLogin(selected)}
                  >
                    {busy === "username-reset:" + selected.personId ? t.resetting : t.usernameReset}
                  </button>
                ) : null}
              </div>
            ) : null}

            {selected.accountStatus === "not_created" && selected.portalUsername ? (
              <button
                className="action-button action-button-primary"
                type="button"
                disabled={busy !== null}
                onClick={() => void createUsernameLogin(selected)}
              >
                {busy === "username:" + selected.personId ? t.createWithoutEmailBusy : t.createWithoutEmail}
              </button>
            ) : null}

            {!selected.email && selected.kind === "employee" && selected.loginMethod !== "username" && selected.accountStatus !== "not_created" ? <p className="form-message form-error">{t.emailMissing}</p> : null}
            {selected.accountStatus !== "not_created" && !selected.erpManaged && selected.loginMethod !== "username" ? (
              <p className="form-message">{t.existingManagedElsewhere}</p>
            ) : null}

            {selected.loginMethod !== "username" && (selected.kind === "employee" || Boolean(selected.email)) ? (
              <PortalCredentialForm
                key={`${selected.kind}:${selected.personId}:${selected.accountStatus}:${selected.email ?? ""}:${selected.loginMethod ?? ""}`}
                candidate={selected}
                locale={locale}
                busy={busy}
                onSubmit={submit}
              />
            ) : null}
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

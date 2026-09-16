"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { hrCopy } from "@/lib/hr/copy";

type Employee = { employmentId: number; employeeNumber: string; displayName: string };
type LeaveType = { id: number; key: string; labels: Record<string, unknown>; payrollEffect: string };
type LeaveRow = { id: number; employmentId: number; employeeNumber: string; displayName: string; leaveTypeId: number; leaveTypeKey: string; labels: Record<string, unknown>; startsOn: string; endsOn: string; requestedUnits: number; reason: string | null; state: string; decisionReason: string | null };
type Data = { canManage: boolean; leaveTypes: LeaveType[]; rows: LeaveRow[] };
type UiLocale = "en" | "ur";

const stateCopy = {
  en: { submitted: "Submitted", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled", withdrawn: "Withdrawn", unknown: "Unknown status" },
  ur: { submitted: "زیرِ التوا", approved: "منظور", rejected: "مسترد", cancelled: "منسوخ", withdrawn: "واپس لی گئی", unknown: "نامعلوم حالت" }
} as const;

function label(labels: Record<string, unknown>, locale: Locale, fallback: string) {
  const value = labels[locale] ?? labels.en;
  return typeof value === "string" ? value : fallback;
}

function stateLabel(state: string, locale: Locale) {
  const text = stateCopy[locale === "ur" ? "ur" : "en"];
  if (state === "submitted") return text.submitted;
  if (state === "approved") return text.approved;
  if (state === "rejected") return text.rejected;
  if (state === "cancelled") return text.cancelled;
  if (state === "withdrawn") return text.withdrawn;
  return text.unknown;
}

function localizedApprovalReason(locale: Locale) {
  return locale === "ur" ? "HR نے منظور کیا" : "Approved by HR";
}

export function HrLeaveWorkspace({ locale, data, employees }: { locale: Locale; data: Data; employees: Employee[] }) {
  const t = hrCopy[locale];
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const response = await fetch("/api/hr/leave", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(locale === "ur" ? t.error : (payload.error || t.error));
        return;
      }
      router.refresh();
    } catch {
      setError(t.error);
    } finally {
      setBusy(null);
    }
  }

  const unavailable = busy !== null;
  const language: UiLocale = locale === "ur" ? "ur" : "en";

  return <div className="hr-leave-workspace" aria-busy={unavailable || undefined} data-ui-locale={language}>
    {error ? <p className="form-message form-error" role="alert">{error}</p> : null}

    {data.canManage ? <form className="panel hr-leave-form" aria-busy={busy === "submit" || undefined} onSubmit={(event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      void post({
        employmentId: Number(formData.get("employmentId")),
        leaveTypeId: Number(formData.get("leaveTypeId")),
        startsOn: String(formData.get("startsOn") || ""),
        endsOn: String(formData.get("endsOn") || ""),
        reason: String(formData.get("reason") || "")
      }, "submit");
    }}>
      <label className="field-label">{t.employees}<select className="text-field" name="employmentId" required disabled={unavailable}>{employees.map((employee) => <option key={employee.employmentId} value={employee.employmentId}>{employee.displayName} · {employee.employeeNumber}</option>)}</select></label>
      <label className="field-label">{t.leaveType}<select className="text-field" name="leaveTypeId" required disabled={unavailable}>{data.leaveTypes.map((leaveType) => <option key={leaveType.id} value={leaveType.id}>{label(leaveType.labels, locale, leaveType.key)}</option>)}</select></label>
      <label className="field-label">{t.from}<input className="text-field" type="date" name="startsOn" required disabled={unavailable} /></label>
      <label className="field-label">{t.to}<input className="text-field" type="date" name="endsOn" required disabled={unavailable} /></label>
      <label className="field-label hr-wide">{t.reason}<input className="text-field" name="reason" maxLength={1000} disabled={unavailable} /></label>
      <button className="action-button action-button-primary" type="submit" disabled={unavailable} aria-busy={busy === "submit" || undefined}>{busy === "submit" ? <><span className="inline-spinner" aria-hidden="true" />{t.saving}</> : t.submitLeave}</button>
    </form> : null}

    <section className="hr-leave-list">{data.rows.length ? data.rows.map((row) => {
      const approveKey = `approve-${row.id}`;
      const rejectKey = `reject-${row.id}`;
      return <article className="panel hr-leave-row" key={row.id} aria-busy={(busy === approveKey || busy === rejectKey) || undefined}>
        <div><p className="state-kicker">{row.employeeNumber}</p><h3>{row.displayName}</h3><p>{label(row.labels, locale, row.leaveTypeKey)} · {row.startsOn} → {row.endsOn} · {row.requestedUnits} {t.requestedUnits}</p>{row.reason ? <small>{row.reason}</small> : null}</div>
        <span className="status-chip">{stateLabel(row.state, locale)}</span>
        {data.canManage && row.state === "submitted" ? <div className="hr-leave-decisions">
          <button className="action-button action-button-primary" type="button" disabled={unavailable} aria-busy={busy === approveKey || undefined} onClick={() => void post({ action: "decide", leaveRequestId: row.id, decision: "approved", reason: localizedApprovalReason(locale) }, approveKey)}>{busy === approveKey ? <><span className="inline-spinner" aria-hidden="true" />{t.saving}</> : t.approve}</button>
          <form aria-busy={busy === rejectKey || undefined} onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            void post({ action: "decide", leaveRequestId: row.id, decision: "rejected", reason: String(formData.get("reason") || "") }, rejectKey);
          }}>
            <input className="text-field" name="reason" minLength={4} placeholder={t.reason} disabled={unavailable} />
            <button className="action-button" type="submit" disabled={unavailable} aria-busy={busy === rejectKey || undefined}>{busy === rejectKey ? <><span className="inline-spinner" aria-hidden="true" />{t.saving}</> : t.reject}</button>
          </form>
        </div> : row.decisionReason ? <small>{row.decisionReason}</small> : null}
      </article>;
    }) : <div className="panel hr-empty">{t.noHistory}</div>}</section>
  </div>;
}

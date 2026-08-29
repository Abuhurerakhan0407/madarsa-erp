"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { admissionStateLabel } from "@/lib/admissions/enquiry-labels";
import type { AdmissionStaffAction } from "@/lib/admissions/staff-action-model";
import type { Locale } from "@/lib/i18n/config";

type AdmissionActionPanelProps = {
  applicationId: number;
  state: string;
  locale: Locale;
};

type ActionOption = {
  action: AdmissionStaffAction;
  label: string;
  needsReason?: boolean;
};

const copy = {
  en: {
    title: "Workflow actions",
    body: "Actions follow this application's pinned admission workflow and your role permissions.",
    note: "Review note (optional)",
    reason: "Decision reason",
    start_review: "Start review",
    complete_review: "Complete review",
    offer: "Offer admission",
    waitlist: "Waitlist",
    reject: "Reject",
    working: "Updating…",
    success: "Application workflow updated.",
    error: "Unable to update this application.",
    noAction: "No staff action is available from this state yet."
  },
  ur: {
    title: "داخلہ کارروائی",
    body: "تمام کارروائیاں اسی درخواست کے محفوظ شدہ ورک فلو اور آپ کی اجازتوں کے مطابق ہوتی ہیں۔",
    note: "جائزہ نوٹ (اختیاری)",
    reason: "فیصلے کی وجہ",
    start_review: "جائزہ شروع کریں",
    complete_review: "جائزہ مکمل کریں",
    offer: "داخلہ پیش کریں",
    waitlist: "انتظار فہرست میں رکھیں",
    reject: "مسترد کریں",
    working: "اپ ڈیٹ ہو رہا ہے…",
    success: "درخواست کا ورک فلو اپ ڈیٹ ہو گیا۔",
    error: "درخواست اپ ڈیٹ نہیں ہو سکی۔",
    noAction: "اس حالت سے ابھی کوئی عمل دستیاب نہیں ہے۔"
  },
  ar: {
    title: "إجراءات القبول",
    body: "تتبع الإجراءات مسار العمل المثبت لهذا الطلب وصلاحيات دورك.",
    note: "ملاحظة المراجعة (اختياري)",
    reason: "سبب القرار",
    start_review: "بدء المراجعة",
    complete_review: "إكمال المراجعة",
    offer: "تقديم عرض قبول",
    waitlist: "إضافة إلى قائمة الانتظار",
    reject: "رفض",
    working: "جارٍ التحديث…",
    success: "تم تحديث مسار الطلب.",
    error: "تعذر تحديث هذا الطلب.",
    noAction: "لا يوجد إجراء متاح من هذه الحالة حاليًا."
  }
} as const;

function optionsForState(state: string, locale: Locale): ActionOption[] {
  const text = copy[locale];
  if (state === "submitted") return [{ action: "start_review", label: text.start_review }];
  if (state === "verification") return [{ action: "complete_review", label: text.complete_review }];
  if (state === "decision") {
    return [
      { action: "offer", label: text.offer, needsReason: true },
      { action: "waitlist", label: text.waitlist, needsReason: true },
      { action: "reject", label: text.reject, needsReason: true }
    ];
  }
  return [];
}

export function AdmissionActionPanel({ applicationId, state, locale }: AdmissionActionPanelProps) {
  const router = useRouter();
  const text = copy[locale];
  const options = optionsForState(state, locale);
  const [reason, setReason] = useState("");
  const [busyAction, setBusyAction] = useState<AdmissionStaffAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: AdmissionStaffAction, needsReason = false) {
    setMessage(null);
    setError(null);

    if (needsReason && reason.trim().length < 8) {
      setError(text.error);
      return;
    }

    setBusyAction(action);
    try {
      const response = await fetch("/api/admissions/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          applicationId,
          action,
          ...(reason.trim() ? { reason: reason.trim() } : {})
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || text.error);
        return;
      }

      setReason("");
      setMessage(text.success);
      router.refresh();
    } catch {
      setError(text.error);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="configuration-detail-card" aria-labelledby="admission-actions-title">
      <span>{admissionStateLabel(locale, state)}</span>
      <h2 id="admission-actions-title">{text.title}</h2>
      <p>{text.body}</p>

      {options.length === 0 ? <p>{text.noAction}</p> : null}

      {state === "verification" || state === "decision" ? (
        <label className="field-label">
          {state === "decision" ? text.reason : text.note}
          <textarea
            className="text-field"
            maxLength={2000}
            minLength={state === "decision" ? 8 : undefined}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            value={reason}
          />
        </label>
      ) : null}

      {options.length > 0 ? (
        <div className="quick-actions">
          {options.map((option) => (
            <button
              className={`action-button ${option.action === "reject" ? "" : "action-button-primary"}`}
              disabled={busyAction !== null}
              key={option.action}
              onClick={() => run(option.action, option.needsReason)}
              type="button"
            >
              {busyAction === option.action ? text.working : option.label}
            </button>
          ))}
        </div>
      ) : null}

      {message ? <p className="form-message" role="status">{message}</p> : null}
      {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
    </section>
  );
}

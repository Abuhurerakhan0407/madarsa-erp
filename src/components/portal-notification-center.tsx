'use client';

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";
import type { PortalNotificationCenter as Center, PortalNotificationItem } from "@/lib/notifications/portal";
import { formatPortalDateTime, localizedPortalText, preservePortalLocale } from "@/lib/portal/locale";

type Props = { tenantId: number; initial: Center; locale: SupportedLocale };

const copy = {
  en: {
    kicker: "Notification center",
    updates: "Updates",
    unread: "unread",
    body: "Homework, holidays, schedule changes, attendance alerts, results, and institution notices appear here.",
    pushEnabled: "Push enabled",
    enabling: "Enabling…",
    enablePush: "Enable push",
    notConfigured: "In-app notifications are active. Browser push delivery is not configured on this deployment yet.",
    unsupported: "This browser does not support web push. In-app notifications still work.",
    denied: "Push permission was not granted. You can continue using the in-app notification center.",
    pushError: "Push could not be enabled. In-app notifications are unaffected.",
    noNotifications: "No notifications yet.",
    urgent: "Urgent",
    important: "Important",
    normal: "Normal",
    update: "Update",
    saving: "Saving…",
    markRead: "Mark read",
    read: "Read",
    open: "Open",
    markReadError: "Unable to mark this notification as read. Please try again.",
    institution: "Institution",
    attendance: "Attendance",
    academics: "Academics",
    exams: "Exams",
    quran: "Qur'an",
    homework: "Homework",
    portal: "Portal"
  },
  ur: {
    kicker: "اطلاعات مرکز",
    updates: "تازہ اطلاعات",
    unread: "نئی",
    body: "گھر کا کام، تعطیلات، شیڈول تبدیلیاں، حاضری الرٹس، نتائج اور ادارے کی اطلاعات یہاں نظر آتی ہیں۔",
    pushEnabled: "پش اطلاعات فعال ہیں",
    enabling: "فعال ہو رہی ہیں…",
    enablePush: "پش اطلاعات فعال کریں",
    notConfigured: "ایپ کے اندر اطلاعات فعال ہیں۔ اس تعیناتی پر براؤزر پش ابھی ترتیب نہیں دیا گیا۔",
    unsupported: "یہ براؤزر ویب پش کو سپورٹ نہیں کرتا۔ ایپ کے اندر اطلاعات پھر بھی کام کریں گی۔",
    denied: "پش اجازت نہیں دی گئی۔ آپ ایپ کے اندر اطلاعات مرکز استعمال کر سکتے ہیں۔",
    pushError: "پش فعال نہیں ہو سکا۔ ایپ کے اندر اطلاعات متاثر نہیں ہوئیں۔",
    noNotifications: "ابھی کوئی اطلاع نہیں۔",
    urgent: "فوری",
    important: "اہم",
    normal: "معمول",
    update: "تازہ اطلاع",
    saving: "محفوظ ہو رہا ہے…",
    markRead: "پڑھی ہوئی نشان زد کریں",
    read: "پڑھی ہوئی",
    open: "کھولیں",
    markReadError: "اطلاع کو پڑھی ہوئی نشان زد نہیں کیا جا سکا۔ دوبارہ کوشش کریں۔",
    institution: "ادارہ",
    attendance: "حاضری",
    academics: "تعلیم",
    exams: "امتحانات",
    quran: "قرآن",
    homework: "گھر کا کام",
    portal: "پورٹل"
  }
} as const;

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function priorityLabel(priority: PortalNotificationItem["priority"], locale: SupportedLocale) {
  const t = copy[locale];
  return priority === "urgent" ? t.urgent : priority === "important" ? t.important : t.normal;
}

function moduleLabel(value: string, locale: SupportedLocale) {
  const t = copy[locale];
  const normalized = value.toLowerCase().replace(/[^a-z]/g, "");
  const known: Record<string, string> = {
    institution: t.institution,
    attendance: t.attendance,
    academics: t.academics,
    exams: t.exams,
    exam: t.exams,
    quran: t.quran,
    homework: t.homework,
    portal: t.portal
  };
  return known[normalized] ?? value;
}

export function PortalNotificationCenter({ tenantId, initial, locale }: Props) {
  const t = copy[locale];
  const [items, setItems] = useState(initial.items);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [readErrorId, setReadErrorId] = useState<number | null>(null);
  const [pushState, setPushState] = useState<"idle" | "working" | "enabled" | "unsupported" | "not-configured" | "denied" | "error">("idle");
  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);
  const ordered = useMemo(() => [...items].sort((a, b) => {
    const rank = { urgent: 3, important: 2, normal: 1 } as const;
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
    if (rank[a.priority] !== rank[b.priority]) return rank[b.priority] - rank[a.priority];
    return Date.parse(b.sentAt) - Date.parse(a.sentAt);
  }), [items]);

  async function markRead(id: number) {
    setBusyId(id);
    setReadErrorId(null);
    try {
      const response = await fetch("/api/portal/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, dispatchId: id })
      });
      if (!response.ok) throw new Error("read_failed");
      setItems((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item));
    } catch {
      setReadErrorId(id);
    } finally {
      setBusyId(null);
    }
  }

  async function enablePush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushState("unsupported");
      return;
    }
    setPushState("working");
    try {
      const configResponse = await fetch(`/api/portal/push?tenant=${tenantId}`, { cache: "no-store" });
      const config = await configResponse.json() as { publicKey?: string | null };
      if (!configResponse.ok || !config.publicKey) {
        setPushState("not-configured");
        return;
      }
      const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted") {
        setPushState("denied");
        return;
      }
      const registration = await navigator.serviceWorker.register("/portal-sw.js", { scope: "/" });
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(config.publicKey)
      });
      const response = await fetch("/api/portal/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, subscription: subscription.toJSON(), deviceLabel: navigator.userAgent.slice(0, 120) })
      });
      if (!response.ok) throw new Error("push_failed");
      setPushState("enabled");
    } catch {
      setPushState("error");
    }
  }

  return (
    <section className="professional-card" aria-labelledby="portal-notifications-title">
      <div className="section-heading">
        <div>
          <p className="state-kicker">{t.kicker}</p>
          <h2 id="portal-notifications-title">{t.updates} {unreadCount > 0 ? `· ${unreadCount} ${t.unread}` : ""}</h2>
          <p>{t.body}</p>
        </div>
        <button className="action-button" type="button" onClick={enablePush} disabled={pushState === "working" || pushState === "enabled"} aria-busy={pushState === "working" || undefined}>
          {pushState === "working" ? <><span className="inline-spinner" aria-hidden="true" /><span>{t.enabling}</span></> : pushState === "enabled" ? t.pushEnabled : t.enablePush}
        </button>
      </div>
      {pushState === "not-configured" ? <p role="status">{t.notConfigured}</p> : null}
      {pushState === "unsupported" ? <p role="status">{t.unsupported}</p> : null}
      {pushState === "denied" ? <p role="status">{t.denied}</p> : null}
      {pushState === "error" ? <p role="alert">{t.pushError}</p> : null}
      {ordered.length === 0 ? <p>{t.noNotifications}</p> : (
        <div className="flow-stack">
          {ordered.map((item) => (
            <article className="demo-card" key={item.id} style={{ opacity: item.isRead ? 0.72 : 1 }}>
              <div className="section-heading">
                <div>
                  <p className="state-kicker">{priorityLabel(item.priority, locale)} · {moduleLabel(item.sourceModule, locale)}</p>
                  <h3>{localizedPortalText(item.title, locale, t.update)}</h3>
                </div>
                {!item.isRead ? (
                  <button className="action-button" type="button" onClick={() => markRead(item.id)} disabled={busyId === item.id} aria-busy={busyId === item.id || undefined}>
                    {busyId === item.id ? <><span className="inline-spinner" aria-hidden="true" /><span>{t.saving}</span></> : t.markRead}
                  </button>
                ) : <small>{t.read}</small>}
              </div>
              <p>{localizedPortalText(item.body, locale)}</p>
              {readErrorId === item.id ? <p className="form-message form-error" role="alert">{t.markReadError}</p> : null}
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <small>{formatPortalDateTime(item.sentAt, locale)}</small>
                {item.link ? <Link className="action-button" href={preservePortalLocale(item.link, locale)}>{t.open}</Link> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

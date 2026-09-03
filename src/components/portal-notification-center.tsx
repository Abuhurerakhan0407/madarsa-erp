'use client';

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PortalNotificationCenter as Center, PortalNotificationItem } from "@/lib/notifications/portal";

type Props = { tenantId: number; initial: Center };

function label(value: Record<string, unknown>) {
  for (const key of ["en", "ur", "ar"]) {
    const item = value[key];
    if (typeof item === "string" && item.trim()) return item;
  }
  return "";
}

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function priorityLabel(priority: PortalNotificationItem["priority"]) {
  return priority === "urgent" ? "Urgent" : priority === "important" ? "Important" : "Normal";
}

export function PortalNotificationCenter({ tenantId, initial }: Props) {
  const [items, setItems] = useState(initial.items);
  const [busyId, setBusyId] = useState<number | null>(null);
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
    try {
      const response = await fetch("/api/portal/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, dispatchId: id })
      });
      if (!response.ok) throw new Error("Unable to mark notification read.");
      setItems((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item));
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
      if (!response.ok) throw new Error("Push registration failed.");
      setPushState("enabled");
    } catch {
      setPushState("error");
    }
  }

  return <section className="professional-card" aria-labelledby="portal-notifications-title">
    <div className="section-heading">
      <div>
        <p className="state-kicker">Notification center</p>
        <h2 id="portal-notifications-title">Updates {unreadCount > 0 ? `· ${unreadCount} unread` : ""}</h2>
        <p>Homework, holidays, schedule changes, attendance alerts, results, and institution notices appear here.</p>
      </div>
      <button className="action-button" type="button" onClick={enablePush} disabled={pushState === "working" || pushState === "enabled"}>
        {pushState === "enabled" ? "Push enabled" : pushState === "working" ? "Enabling…" : "Enable push"}
      </button>
    </div>
    {pushState === "not-configured" ? <p role="status">In-app notifications are active. Browser push delivery is not configured on this deployment yet.</p> : null}
    {pushState === "unsupported" ? <p role="status">This browser does not support web push. In-app notifications still work.</p> : null}
    {pushState === "denied" ? <p role="status">Push permission was not granted. You can continue using the in-app notification center.</p> : null}
    {pushState === "error" ? <p role="status">Push could not be enabled. In-app notifications are unaffected.</p> : null}
    {ordered.length === 0 ? <p>No notifications yet.</p> : <div className="flow-stack">
      {ordered.map((item) => <article className="demo-card" key={item.id} style={{ opacity: item.isRead ? 0.72 : 1 }}>
        <div className="section-heading">
          <div>
            <p className="state-kicker">{priorityLabel(item.priority)} · {item.sourceModule}</p>
            <h3>{label(item.title) || "Update"}</h3>
          </div>
          {!item.isRead ? <button className="action-button" type="button" onClick={() => markRead(item.id)} disabled={busyId === item.id}>{busyId === item.id ? "Saving…" : "Mark read"}</button> : <small>Read</small>}
        </div>
        <p>{label(item.body)}</p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <small>{new Date(item.sentAt).toLocaleString()}</small>
          {item.link ? <Link className="action-button" href={item.link}>Open</Link> : null}
        </div>
      </article>)}
    </div>}
  </section>;
}

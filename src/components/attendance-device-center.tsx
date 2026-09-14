"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";
import type { AttendanceDeviceCenter } from "@/lib/attendance/device-bridge";

type Copy = {
  register: string;
  deviceKey: string;
  deviceLabel: string;
  modality: string;
  biometric: string;
  vendor: string;
  model: string;
  create: string;
  creating: string;
  rotate: string;
  rotating: string;
  tokenTitle: string;
  tokenWarning: string;
  mappings: string;
  externalSubject: string;
  subjectType: string;
  subject: string;
  map: string;
  mapping: string;
  students: string;
  staff: string;
  events: string;
  apply: string;
  applying: string;
  unmapped: string;
  noEvents: string;
  noDevices: string;
  configured: string;
  lastSeen: string;
  status: string;
  active: string;
  disabled: string;
  received: string;
  applied: string;
  failed: string;
  presence: string;
  checkIn: string;
  checkOut: string;
  error: string;
};

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error("Request failed.");
  return payload;
}

function formatDateTime(value: string | null, locale: Locale) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "ur" ? "ur-PK" : locale === "ar" ? "ar-SA" : "en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function stateLabel(value: string, copy: Copy) {
  if (value === "active") return copy.active;
  if (value === "disabled") return copy.disabled;
  if (value === "received") return copy.received;
  if (value === "applied") return copy.applied;
  if (value === "failed" || value === "error") return copy.failed;
  return value;
}

function eventTypeLabel(value: string, copy: Copy) {
  if (value === "presence") return copy.presence;
  if (value === "check_in") return copy.checkIn;
  if (value === "check_out") return copy.checkOut;
  return value;
}

export function AttendanceDeviceCenterView({ data, copy, locale }: { data: AttendanceDeviceCenter; copy: Copy; locale: Locale }) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [subjectType, setSubjectType] = useState<"student" | "staff">("student");

  // The current Ilmgaah product surface is biometric-only. Historical non-biometric
  // records can remain in storage for compatibility, but they are not exposed as an
  // active configuration or attendance capability.
  const devices = useMemo(() => data.devices.filter((device) => device.modality === "biometric"), [data.devices]);
  const biometricDeviceIds = useMemo(() => new Set(devices.map((device) => device.id)), [devices]);
  const mappings = useMemo(() => data.mappings.filter((mapping) => biometricDeviceIds.has(mapping.deviceId)), [biometricDeviceIds, data.mappings]);
  const events = useMemo(() => data.events.filter((event) => event.modality === "biometric" && biometricDeviceIds.has(event.deviceId)), [biometricDeviceIds, data.events]);
  const candidates = useMemo(() => subjectType === "student" ? data.students : data.staff, [data.staff, data.students, subjectType]);
  const busy = busyAction !== null;

  async function createDevice(formData: FormData) {
    setBusyAction("create");
    setMessage(null);
    setToken(null);
    try {
      const result = await postJson("/api/attendance/devices", {
        externalDeviceKey: formData.get("externalDeviceKey"),
        label: formData.get("label"),
        modality: "biometric",
        vendor: formData.get("vendor"),
        model: formData.get("model")
      });
      setToken(typeof result.ingestToken === "string" ? result.ingestToken : null);
      router.refresh();
    } catch {
      setMessage(copy.error);
    } finally {
      setBusyAction(null);
    }
  }

  async function rotateDevice(deviceId: number) {
    setBusyAction(`rotate:${deviceId}`);
    setMessage(null);
    setToken(null);
    try {
      const result = await postJson(`/api/attendance/devices/${deviceId}/rotate`, {});
      setToken(typeof result.ingestToken === "string" ? result.ingestToken : null);
      router.refresh();
    } catch {
      setMessage(copy.error);
    } finally {
      setBusyAction(null);
    }
  }

  async function mapSubject(formData: FormData) {
    setBusyAction("mapping");
    setMessage(null);
    try {
      await postJson("/api/attendance/device-mappings", {
        deviceId: Number(formData.get("deviceId")),
        externalSubjectKey: formData.get("externalSubjectKey"),
        subjectType,
        subjectId: Number(formData.get("subjectId"))
      });
      router.refresh();
    } catch {
      setMessage(copy.error);
    } finally {
      setBusyAction(null);
    }
  }

  async function applyEvent(eventId: number) {
    setBusyAction(`apply:${eventId}`);
    setMessage(null);
    try {
      await postJson(`/api/attendance/device-events/${eventId}/apply`, {});
      router.refresh();
    } catch {
      setMessage(copy.error);
    } finally {
      setBusyAction(null);
    }
  }

  return <div className="documents-shell" aria-busy={busy || undefined}>
    {message ? <p className="panel empty-state" role="alert">{message}</p> : null}
    {token ? <section className="panel"><h2>{copy.tokenTitle}</h2><p>{copy.tokenWarning}</p><code className="verification-code">{token}</code></section> : null}

    <section className="panel">
      <h2>{copy.register}</h2>
      <form action={createDevice} className="detail-grid" aria-busy={busyAction === "create" || undefined}>
        <label className="field-label">{copy.deviceKey}<input className="text-field" name="externalDeviceKey" required minLength={3} maxLength={120} placeholder="gate-01" disabled={busy} /></label>
        <label className="field-label">{copy.deviceLabel}<input className="text-field" name="label" required minLength={2} maxLength={120} placeholder="Main gate biometric" disabled={busy} /></label>
        <div className="field-label"><span>{copy.modality}</span><span className="status-pill">{copy.biometric}</span></div>
        <label className="field-label">{copy.vendor}<input className="text-field" name="vendor" maxLength={120} disabled={busy} /></label>
        <label className="field-label">{copy.model}<input className="text-field" name="model" maxLength={120} disabled={busy} /></label>
        <div><button className="action-button" type="submit" disabled={busy} aria-busy={busyAction === "create" || undefined}>{busyAction === "create" ? <><span className="inline-spinner" aria-hidden="true" />{copy.creating}</> : copy.create}</button></div>
      </form>
    </section>

    <section className="panel">
      <h2>{copy.configured}</h2>
      {devices.length ? <div className="documents-recent"><div>{devices.map((device) => {
        const rotating = busyAction === `rotate:${device.id}`;
        return <article key={device.id}><div><strong>{device.label}</strong><small>{device.externalDeviceKey} · {copy.biometric} · ••••{device.tokenHint}</small></div><div><small>{copy.status}: {stateLabel(device.state, copy)}</small><small>{copy.lastSeen}: {formatDateTime(device.lastSeenAt, locale)}</small><button className="secondary-button" type="button" disabled={busy} aria-busy={rotating || undefined} onClick={() => rotateDevice(device.id)}>{rotating ? <><span className="inline-spinner" aria-hidden="true" />{copy.rotating}</> : copy.rotate}</button></div></article>;
      })}</div></div> : <p className="empty-state">{copy.noDevices}</p>}
    </section>

    <section className="panel">
      <h2>{copy.mappings}</h2>
      <form action={mapSubject} className="detail-grid" aria-busy={busyAction === "mapping" || undefined}>
        <label className="field-label">{copy.deviceLabel}<select className="text-field" name="deviceId" required disabled={busy}>{devices.map((device) => <option key={device.id} value={device.id}>{device.label}</option>)}</select></label>
        <label className="field-label">{copy.externalSubject}<input className="text-field" name="externalSubjectKey" required maxLength={120} placeholder="device-user-001" disabled={busy} /></label>
        <label className="field-label">{copy.subjectType}<select className="text-field" value={subjectType} disabled={busy} onChange={(event) => setSubjectType(event.target.value === "staff" ? "staff" : "student")}><option value="student">{copy.students}</option><option value="staff">{copy.staff}</option></select></label>
        <label className="field-label">{copy.subject}<select className="text-field" name="subjectId" required disabled={busy}>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.number} · {candidate.name}</option>)}</select></label>
        <div><button className="action-button" type="submit" disabled={busy || !devices.length || !candidates.length} aria-busy={busyAction === "mapping" || undefined}>{busyAction === "mapping" ? <><span className="inline-spinner" aria-hidden="true" />{copy.mapping}</> : copy.map}</button></div>
      </form>
      {mappings.length ? <div className="documents-recent"><div>{mappings.map((mapping) => <article key={mapping.id}><div><strong>{mapping.deviceLabel} · {mapping.externalSubjectKey}</strong><small>{mapping.subjectType === "student" ? copy.students : copy.staff}</small></div><span>{mapping.subjectNumber ?? "—"} · {mapping.subjectName ?? "—"}</span></article>)}</div></div> : null}
    </section>

    <section className="panel">
      <h2>{copy.events}</h2>
      {events.length ? <div className="documents-recent"><div>{events.map((event) => {
        const applying = busyAction === `apply:${event.id}`;
        return <article key={event.id}><div><strong>{event.deviceLabel} · {eventTypeLabel(event.eventType, copy)}</strong><small>{event.externalSubjectKey} · {formatDateTime(event.occurredAt, locale)}</small><small>{event.subjectName ? `${event.subjectNumber ?? ""} ${event.subjectName}` : copy.unmapped}</small>{event.errorReason ? <small dir="auto">{event.errorReason}</small> : null}</div><div><span>{stateLabel(event.state, copy)}</span>{event.subjectName && event.state !== "applied" ? <button className="secondary-button" type="button" disabled={busy} aria-busy={applying || undefined} onClick={() => applyEvent(event.id)}>{applying ? <><span className="inline-spinner" aria-hidden="true" />{copy.applying}</> : copy.apply}</button> : null}</div></article>;
      })}</div></div> : <p className="empty-state">{copy.noEvents}</p>}
    </section>
  </div>;
}

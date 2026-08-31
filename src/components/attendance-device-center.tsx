"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AttendanceDeviceCenter } from "@/lib/attendance/device-bridge";

type Copy = { register: string; deviceKey: string; deviceLabel: string; modality: string; vendor: string; model: string; create: string; tokenTitle: string; tokenWarning: string; mappings: string; externalSubject: string; subjectType: string; subject: string; map: string; students: string; staff: string; events: string; apply: string; unmapped: string; noEvents: string; noDevices: string; configured: string; lastSeen: string; status: string; error: string };

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Request failed.");
  return payload;
}

export function AttendanceDeviceCenterView({ data, copy }: { data: AttendanceDeviceCenter; copy: Copy }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [subjectType, setSubjectType] = useState<"student" | "staff">("student");
  const candidates = useMemo(() => subjectType === "student" ? data.students : data.staff, [data.staff, data.students, subjectType]);

  async function createDevice(formData: FormData) {
    setBusy(true); setMessage(null); setToken(null);
    try {
      const result = await postJson("/api/attendance/devices", { externalDeviceKey: formData.get("externalDeviceKey"), label: formData.get("label"), modality: formData.get("modality"), vendor: formData.get("vendor"), model: formData.get("model") });
      setToken(typeof result.ingestToken === "string" ? result.ingestToken : null); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : copy.error); } finally { setBusy(false); }
  }

  async function mapSubject(formData: FormData) {
    setBusy(true); setMessage(null);
    try {
      await postJson("/api/attendance/device-mappings", { deviceId: Number(formData.get("deviceId")), externalSubjectKey: formData.get("externalSubjectKey"), subjectType, subjectId: Number(formData.get("subjectId")) });
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : copy.error); } finally { setBusy(false); }
  }

  async function applyEvent(eventId: number) {
    setBusy(true); setMessage(null);
    try { await postJson(`/api/attendance/device-events/${eventId}/apply`, {}); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : copy.error); } finally { setBusy(false); }
  }

  return <div className="documents-shell">
    {message ? <p className="panel empty-state">{message}</p> : null}
    {token ? <section className="panel"><h2>{copy.tokenTitle}</h2><p>{copy.tokenWarning}</p><code className="verification-code">{token}</code></section> : null}

    <section className="panel"><h2>{copy.register}</h2><form action={createDevice} className="detail-grid">
      <label className="field-label">{copy.deviceKey}<input className="text-field" name="externalDeviceKey" required minLength={3} maxLength={120} placeholder="gate-01" /></label>
      <label className="field-label">{copy.deviceLabel}<input className="text-field" name="label" required minLength={2} maxLength={120} placeholder="Main gate biometric" /></label>
      <label className="field-label">{copy.modality}<select className="text-field" name="modality" defaultValue="biometric"><option value="biometric">Biometric</option><option value="nfc">NFC</option><option value="hybrid">Hybrid</option></select></label>
      <label className="field-label">{copy.vendor}<input className="text-field" name="vendor" maxLength={120} /></label>
      <label className="field-label">{copy.model}<input className="text-field" name="model" maxLength={120} /></label>
      <div><button className="action-button" type="submit" disabled={busy}>{copy.create}</button></div>
    </form></section>

    <section className="panel"><h2>{copy.configured}</h2>{data.devices.length ? <div className="documents-recent"><div>{data.devices.map((device) => <article key={device.id}><div><strong>{device.label}</strong><small>{device.externalDeviceKey} · {device.modality} · ••••{device.tokenHint}</small></div><div><small>{copy.status}: {device.state}</small><small>{copy.lastSeen}: {device.lastSeenAt ?? "—"}</small></div></article>)}</div></div> : <p className="empty-state">{copy.noDevices}</p>}</section>

    <section className="panel"><h2>{copy.mappings}</h2><form action={mapSubject} className="detail-grid">
      <label className="field-label">{copy.deviceLabel}<select className="text-field" name="deviceId" required>{data.devices.map((device) => <option key={device.id} value={device.id}>{device.label}</option>)}</select></label>
      <label className="field-label">{copy.externalSubject}<input className="text-field" name="externalSubjectKey" required maxLength={120} placeholder="device-user-001" /></label>
      <label className="field-label">{copy.subjectType}<select className="text-field" value={subjectType} onChange={(event) => setSubjectType(event.target.value === "staff" ? "staff" : "student")}><option value="student">{copy.students}</option><option value="staff">{copy.staff}</option></select></label>
      <label className="field-label">{copy.subject}<select className="text-field" name="subjectId" required>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.number} · {candidate.name}</option>)}</select></label>
      <div><button className="action-button" type="submit" disabled={busy || !data.devices.length || !candidates.length}>{copy.map}</button></div>
    </form>
    {data.mappings.length ? <div className="documents-recent"><div>{data.mappings.map((mapping) => <article key={mapping.id}><div><strong>{mapping.deviceLabel} · {mapping.externalSubjectKey}</strong><small>{mapping.subjectType}</small></div><span>{mapping.subjectNumber ?? "—"} · {mapping.subjectName ?? "—"}</span></article>)}</div></div> : null}</section>

    <section className="panel"><h2>{copy.events}</h2>{data.events.length ? <div className="documents-recent"><div>{data.events.map((event) => <article key={event.id}><div><strong>{event.deviceLabel} · {event.eventType}</strong><small>{event.externalSubjectKey} · {new Date(event.occurredAt).toLocaleString()}</small><small>{event.subjectName ? `${event.subjectNumber ?? ""} ${event.subjectName}` : copy.unmapped}</small>{event.errorReason ? <small>{event.errorReason}</small> : null}</div><div><span>{event.state}</span>{event.subjectName && event.state !== "applied" ? <button className="secondary-button" type="button" disabled={busy} onClick={() => applyEvent(event.id)}>{copy.apply}</button> : null}</div></article>)}</div></div> : <p className="empty-state">{copy.noEvents}</p>}</section>
  </div>;
}

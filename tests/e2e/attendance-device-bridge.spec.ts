import { expect, test } from "@playwright/test";

test("attendance device creation rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/attendance/devices", { data: { externalDeviceKey: "gate-01", label: "Gate", modality: "biometric" } });
  expect(response.status()).toBe(401);
});

test("attendance device mapping rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/attendance/device-mappings", { data: { deviceId: 1, externalSubjectKey: "user-1", subjectType: "student", subjectId: 1 } });
  expect(response.status()).toBe(401);
});

test("attendance device event application rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/attendance/device-events/1/apply", { data: {} });
  expect(response.status()).toBe(401);
});

test("attendance device token rotation rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/attendance/devices/1/rotate", { data: {} });
  expect(response.status()).toBe(401);
});

test("device ingest requires a device token before database access", async ({ request }) => {
  const response = await request.post("/api/attendance/device-ingest", { data: { externalDeviceKey: "gate-01", externalEventId: "event-0001", externalSubjectKey: "user-1", modality: "biometric", eventType: "presence", occurredAt: new Date().toISOString() } });
  expect(response.status()).toBe(401);
});

test("device ingest validates payload before attempting authenticated device lookup", async ({ request }) => {
  const response = await request.post("/api/attendance/device-ingest", { headers: { "x-device-token": "fake-device-token" }, data: { externalDeviceKey: "gate-01", externalEventId: "event-0001", externalSubjectKey: "user-1", modality: "unsupported", eventType: "presence", occurredAt: new Date().toISOString() } });
  expect(response.status()).toBe(400);
});

test("device ingest rejects retired NFC modality before authenticated device lookup", async ({ request }) => {
  const response = await request.post("/api/attendance/device-ingest", { headers: { "x-device-token": "fake-device-token" }, data: { externalDeviceKey: "gate-01", externalEventId: "event-nfc-0001", externalSubjectKey: "user-1", modality: "nfc", eventType: "presence", occurredAt: new Date().toISOString() } });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: "Device event is invalid." });
});

test("device ingest refuses raw biometric material before database access", async ({ request }) => {
  const response = await request.post("/api/attendance/device-ingest", { headers: { "x-device-token": "fake-device-token" }, data: { externalDeviceKey: "gate-01", externalEventId: "event-0002", externalSubjectKey: "user-1", modality: "biometric", eventType: "presence", occurredAt: new Date().toISOString(), metadata: { fingerprint: "raw-template-material" } } });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: "Raw biometric material must not be sent to ERP." });
});

test("attendance device operator mutations reject cross-origin requests", async ({ request }) => {
  const headers = { origin: "https://attacker.example", "content-type": "application/json" };
  const cases = [
    ["/api/attendance/devices", { externalDeviceKey: "gate-01", label: "Gate", modality: "biometric" }],
    ["/api/attendance/device-mappings", { deviceId: 1, externalSubjectKey: "user-1", subjectType: "student", subjectId: 1 }],
    ["/api/attendance/device-events/1/apply", {}],
    ["/api/attendance/devices/1/rotate", {}]
  ] as const;
  for (const [url, data] of cases) {
    const response = await request.post(url, { headers, data });
    expect(response.status()).toBe(403);
  }
});

test("attendance device operator mutations require JSON", async ({ request }) => {
  for (const url of ["/api/attendance/devices", "/api/attendance/device-mappings", "/api/attendance/device-events/1/apply", "/api/attendance/devices/1/rotate"]) {
    const response = await request.post(url, { headers: { "content-type": "text/plain" }, data: "invalid" });
    expect(response.status()).toBe(415);
  }
});

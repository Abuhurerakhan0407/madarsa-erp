import { expect, test } from "@playwright/test";

const json = { "content-type": "application/json" };

test("attendance start rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/attendance/start", { headers: json, data: { date: "2026-08-31" } });
  expect(response.status()).toBe(401);
});

test("attendance start blocks cross-origin mutations before auth", async ({ request }) => {
  const response = await request.post("/api/attendance/start", { headers: { ...json, origin: "https://attacker.example" }, data: { date: "2026-08-31" } });
  expect(response.status()).toBe(403);
});

test("attendance mark rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/attendance/mark", { headers: json, data: { attendanceSessionId: 1, personId: 4, statusKey: "present", source: "manual" } });
  expect(response.status()).toBe(401);
});

test("attendance mark requires JSON before authentication", async ({ request }) => {
  const response = await request.post("/api/attendance/mark", { headers: { "content-type": "text/plain" }, data: "present" });
  expect(response.status()).toBe(415);
});

test("attendance correction rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/attendance/correct", { headers: json, data: { attendanceRecordId: 1, statusKey: "present", reason: "Incorrect staff entry" } });
  expect(response.status()).toBe(401);
});

test("attendance correction blocks cross-origin mutations before auth", async ({ request }) => {
  const response = await request.post("/api/attendance/correct", { headers: { ...json, origin: "https://attacker.example" }, data: { attendanceRecordId: 1, statusKey: "present", reason: "Incorrect staff entry" } });
  expect(response.status()).toBe(403);
});

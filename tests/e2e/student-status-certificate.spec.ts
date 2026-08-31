import { expect, test } from "@playwright/test";

const json = { "content-type": "application/json" };
const body = { personId: 4, requestKey: "certificate-e2e-request-00001" };

test("certificate issuance rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/documents/student-status-certificate", { headers: json, data: body });
  expect(response.status()).toBe(401);
});

test("certificate issuance blocks cross-origin requests before auth", async ({ request }) => {
  const response = await request.post("/api/documents/student-status-certificate", { headers: { ...json, origin: "https://attacker.example" }, data: body });
  expect(response.status()).toBe(403);
});

test("certificate issuance requires JSON before auth", async ({ request }) => {
  const response = await request.post("/api/documents/student-status-certificate", { headers: { "content-type": "text/plain" }, data: "certificate" });
  expect(response.status()).toBe(415);
});

test("certificate issuance rejects oversized input before auth", async ({ request }) => {
  const response = await request.post("/api/documents/student-status-certificate", { headers: json, data: { ...body, padding: "x".repeat(12000) } });
  expect(response.status()).toBe(413);
});

test("certificate PDF is private", async ({ request }) => {
  const response = await request.get("/api/documents/student-status-certificate/4/pdf");
  expect(response.status()).toBe(401);
});

test("certificate verification page is public", async ({ request }) => {
  const response = await request.get("/certificate/verify");
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("Student Status Certificate");
});

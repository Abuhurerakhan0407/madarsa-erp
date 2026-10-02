import { expect, test } from "@playwright/test";

test("retired claim-code portal APIs stay unavailable", async ({ request }) => {
  const issue = await request.post("/api/portals/access", { data: { personId: 1, linkType: "guardian", expiresInDays: 7 } });
  expect(issue.status()).toBe(404);
  const claim = await request.post("/api/portal/claim", { data: { code: "MDR-0123456789ABCDEF01" } });
  expect(claim.status()).toBe(404);
});

test("portal notice publishing rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/portals/notices", { data: { audienceType: "parents", priority: "important", title: "Demo", body: "Demo notice" } });
  expect(response.status()).toBe(401);
});

test("notification read rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/portal/notifications/read", { data: { tenantId: 1, dispatchId: 1 } });
  expect(response.status()).toBe(401);
});

test("notification read blocks cross-origin callers before authentication", async ({ request }) => {
  const response = await request.post("/api/portal/notifications/read", { headers: { origin: "https://example.invalid" }, data: { tenantId: 1, dispatchId: 1 } });
  expect(response.status()).toBe(403);
});

test("push configuration requires an authenticated portal identity", async ({ request }) => {
  const response = await request.get("/api/portal/push?tenant=1");
  expect(response.status()).toBe(401);
});

test("push registration blocks cross-origin callers before authentication", async ({ request }) => {
  const response = await request.post("/api/portal/push", { headers: { origin: "https://example.invalid" }, data: { tenantId: 1, subscription: { endpoint: "https://example.invalid/push", keys: { p256dh: "x", auth: "y" } } } });
  expect(response.status()).toBe(403);
});

test("portal push service worker is publicly retrievable", async ({ request }) => {
  const response = await request.get("/portal-sw.js");
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("notificationclick");
});

test("portal home redirects anonymous browser sessions to login", async ({ page }) => {
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/login\?next=%2Fportal/);
});

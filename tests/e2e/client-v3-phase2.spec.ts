import { expect, test } from "@playwright/test";

test("Client V3 walk-in admission stays protected behind sign in", async ({ page }) => {
  await page.goto("/ur/students/new");
  await expect(page).toHaveURL(/\/login\?next=%2Fur%2Fstudents%2Fnew$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("walk-in admission API rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/admissions/walk-in", {
    headers: { "content-type": "application/json" },
    data: {
      displayName: "Ahmed Khan",
      ageYears: 11,
      preferredLocale: "ur",
      sessionId: 1,
      programId: 1,
      groupId: 2,
      guardian: { name: "Yusuf Khan", relationship: "father", phone: "+919876543210" }
    }
  });
  expect(response.status()).toBe(401);
});

test("walk-in admission API rejects cross-origin mutations before authentication", async ({ request }) => {
  const response = await request.post("/api/admissions/walk-in", {
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    data: { displayName: "Ahmed Khan" }
  });
  expect(response.status()).toBe(403);
});

test("simple admission actions reject anonymous callers", async ({ request }) => {
  const response = await request.post("/api/admissions/simple-action", {
    headers: { "content-type": "application/json" },
    data: { applicationId: 1, action: "accept" }
  });
  expect(response.status()).toBe(401);
});

test("simple admission actions reject cross-origin mutations first", async ({ request }) => {
  const response = await request.post("/api/admissions/simple-action", {
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    data: { applicationId: 1, action: "reject", reason: "Not eligible" }
  });
  expect(response.status()).toBe(403);
});

import { expect, test } from "@playwright/test";

test("Client V3 global student search does not leak without an active workspace", async ({ request }) => {
  const response = await request.get("/api/students/search?q=Ali&locale=en");
  expect(response.status()).toBe(403);
  const payload = await response.json() as { error?: string; results?: unknown[] };
  expect(payload.results).toBeUndefined();
  expect(payload.error).toBeTruthy();
});

test("Client V3 short student searches return an empty safe result", async ({ request }) => {
  const response = await request.get("/api/students/search?q=a&locale=ur");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({ results: [] });
});

test("Client V3 New Admission route remains protected behind sign in", async ({ page }) => {
  await page.goto("/en/students/new");
  await expect(page).toHaveURL(/\/login\?next=%2Fen%2Fstudents%2Fnew$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

import { expect, test } from "@playwright/test";

test("tracking page is public without exposing an authenticated workspace", async ({ page }) => {
  await page.goto("/track?lang=en");

  await expect(page).toHaveURL(/\/track\?lang=en$/);
  await expect(page.getByRole("heading", { name: "Track your application" })).toBeVisible();
  await expect(page.getByLabel("Tracking reference")).toBeVisible();
  await expect(page.getByLabel("Private tracking key")).toHaveAttribute("type", "password");
});

test("public admission tracking requires a browser origin", async ({ request }) => {
  const response = await request.post("/api/public/admissions/track", {
    headers: { "content-type": "application/json" },
    data: {}
  });

  expect(response.status()).toBe(403);
});

test("public admission tracking rejects cross-origin callers", async ({ request }) => {
  const response = await request.post("/api/public/admissions/track", {
    headers: {
      "content-type": "application/json",
      origin: "https://attacker.example"
    },
    data: {}
  });

  expect(response.status()).toBe(403);
});

test("public admission tracking requires JSON before database access", async ({ request }) => {
  const response = await request.post("/api/public/admissions/track", {
    headers: {
      "content-type": "text/plain",
      origin: "http://localhost:3000"
    },
    data: "tracking"
  });

  expect(response.status()).toBe(415);
});

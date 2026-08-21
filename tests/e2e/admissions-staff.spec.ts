import { expect, test } from "@playwright/test";

test("protects admission detail routes behind sign in", async ({ page }) => {
  await page.goto("/en/admissions/1");
  await expect(page).toHaveURL(/\/login\?next=%2Fen%2Fadmissions%2F1$/);
});

test("staff admission actions reject anonymous callers", async ({ request }) => {
  const response = await request.post("/api/admissions/action", {
    headers: { "content-type": "application/json" },
    data: { applicationId: 1, action: "start_review" }
  });

  expect(response.status()).toBe(401);
});

test("staff admission actions reject cross-origin mutation attempts first", async ({ request }) => {
  const response = await request.post("/api/admissions/action", {
    headers: {
      "content-type": "application/json",
      origin: "https://attacker.example"
    },
    data: { applicationId: 1, action: "start_review" }
  });

  expect(response.status()).toBe(403);
});

test("staff admission actions require JSON before authentication", async ({ request }) => {
  const response = await request.post("/api/admissions/action", {
    headers: { "content-type": "text/plain" },
    data: "start_review"
  });

  expect(response.status()).toBe(415);
});

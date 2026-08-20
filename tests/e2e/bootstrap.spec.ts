import { expect, test } from "@playwright/test";

test("renders repository foundation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Foundation before features." })).toBeVisible();
});

test("health endpoint responds", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({
    status: "ok",
    service: "madarsa-erp"
  });
});

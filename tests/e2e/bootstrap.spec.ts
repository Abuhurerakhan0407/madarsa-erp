import { expect, test } from "@playwright/test";

test("redirects to the English dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { name: "Assalamu alaikum, Usman" })).toBeVisible();
});

test("renders Urdu right to left", async ({ page }) => {
  await page.goto("/ur");
  await expect(page.locator("html")).toHaveAttribute("lang", "ur");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "السلام علیکم، عثمان صاحب" })).toBeVisible();
});

test("renders Arabic right to left", async ({ page }) => {
  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "السلام عليكم، عثمان" })).toBeVisible();
});

test("uses the compact teacher navigation on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");

  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".mobile-nav")).toBeVisible();
  await expect(page.locator(".mobile-nav").getByRole("link")).toHaveCount(4);
});

test("renders empty and forbidden states", async ({ page }) => {
  await page.goto("/en/empty");
  await expect(page.getByRole("heading", { name: "Nothing pending" })).toBeVisible();

  await page.goto("/en/forbidden");
  await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
});

test("opens the admission dialog with an accessible form", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("button", { name: "New admission" }).click();

  const dialog = page.getByRole("dialog", { name: "New admission" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Student name" })).toHaveAttribute(
    "required",
    ""
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});

test("health endpoint responds", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({
    status: "ok",
    service: "madarsa-erp"
  });
});

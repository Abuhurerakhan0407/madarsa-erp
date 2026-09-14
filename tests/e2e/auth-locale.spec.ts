import { expect, test } from "@playwright/test";

function encodedNext(value: string) {
  return encodeURIComponent(value);
}

test("uses an Urdu protected target as the initial sign-in locale", async ({ page }) => {
  await page.goto("/ur/students");
  await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodedNext("/ur/students")}$`));
  await expect(page.locator("main.auth-screen")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "خوش آمدید" })).toBeVisible();
});

test("keeps Urdu portal administration intent through sign in", async ({ page }) => {
  const destination = "/ur/portals";
  await page.goto(destination);
  await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodedNext(destination)}$`));
  await expect(page.locator("main.auth-screen")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "خوش آمدید" })).toBeVisible();
});

test("keeps Urdu self-service portal intent through sign in", async ({ page }) => {
  const destination = "/portal?locale=ur";
  await page.goto(destination);
  await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodedNext(destination)}$`));
  await expect(page.locator("main.auth-screen")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "خوش آمدید" })).toBeVisible();
});

test("preserves Urdu onboarding intent through the anonymous auth redirect", async ({ page }) => {
  const destination = "/onboarding?locale=ur";
  await page.goto(destination);
  await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodedNext(destination)}$`));
  await expect(page.locator("main.auth-screen")).toHaveAttribute("dir", "rtl");
});

test("returns an incomplete Urdu confirmation link to localized sign in", async ({ page }) => {
  await page.goto(`/auth/callback?next=${encodedNext("/ur/students")}`);
  await expect(page).toHaveURL(/\/login\?next=%2Fur%2Fstudents&auth=missing_code$/);
  await expect(page.locator("main.auth-screen")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("main.auth-screen .form-message[role=\"alert\"]")).toContainText("تصدیقی لنک");
});

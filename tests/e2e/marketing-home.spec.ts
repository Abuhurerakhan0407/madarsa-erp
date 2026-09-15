import { expect, test } from "@playwright/test";

test.describe("public Ilmgaah marketing homepage", () => {
  test("is accessible without authentication", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Run your institution with less noise." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ilmgaah home" })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("keeps the authenticated workspace entry point available", async ({ page }) => {
    await page.goto("/");
    const signIn = page.getByRole("banner").getByRole("link", { name: "Sign in" });

    await expect(signIn).toHaveAttribute("href", "/login");
  });
});

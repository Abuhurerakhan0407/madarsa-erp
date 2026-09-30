import { expect, test, type Page } from "@playwright/test";

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
const supabaseSecret = (process.env.SUPABASE_SECRET_KEY ?? "").trim();
const adminEmail = (process.env.E2E_ADMIN_EMAIL ?? "").trim();
const adminPassword = (process.env.E2E_ADMIN_PASSWORD ?? "").trim();

const configured = Boolean(supabaseUrl && supabaseKey && supabaseSecret && adminEmail && adminPassword);

test.beforeAll(() => {
  if (!process.env.CI) return;

  expect(
    {
      NEXT_PUBLIC_SUPABASE_URL: Boolean(supabaseUrl),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: Boolean(supabaseKey),
      SUPABASE_SECRET_KEY: Boolean(supabaseSecret),
      E2E_ADMIN_EMAIL: Boolean(adminEmail),
      E2E_ADMIN_PASSWORD: Boolean(adminPassword)
    },
    "Authenticated Hostel E2E requires the staging Supabase env and admin fixture credentials."
  ).toEqual({
    NEXT_PUBLIC_SUPABASE_URL: true,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: true,
    SUPABASE_SECRET_KEY: true,
    E2E_ADMIN_EMAIL: true,
    E2E_ADMIN_PASSWORD: true
  });
});

async function signInForRoute(page: Page, route: string) {
  await page.goto(route);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("Email address").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const escapedRoute = route.replaceAll("/", "\/");
  await expect(page).toHaveURL(new RegExp("^https?://[^/]+" + escapedRoute + "$"));
}

for (const route of ["/en/hostel", "/ur/hostel"] as const) {
  test("authenticated admin can open " + route, async ({ page }) => {
    test.skip(!configured, "Set staging E2E admin credentials to run authenticated Hostel acceptance.");

    await signInForRoute(page, route);

    if (route === "/en/hostel") {
      await expect(page.getByRole("heading", { name: "Hostel & Mess operations" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Add hostel" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Visitor check-in" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Meal service" })).toBeVisible();
      return;
    }

    await expect(page.getByRole("heading", { name: "ہاسٹل اور میس آپریشنز" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ہاسٹل شامل کریں" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "وزیٹر چیک اِن" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "میل سروس" })).toBeVisible();
  });
}

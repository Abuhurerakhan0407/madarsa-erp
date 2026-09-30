import { expect, test, type Page } from "@playwright/test";
import { provisionStagingRoleUsers } from "./staging-provision";

type Credential = { email: string; password: string };
let adminCredentials: Credential = { email: "", password: "" };

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  if (!process.env.CI) return;
  const projectName = "hostel-" + testInfo.project.name;
  const provisioned = await provisionStagingRoleUsers(projectName);
  adminCredentials = provisioned.credentials.admin;
});

async function signInForRoute(page: Page, route: string) {
  await page.goto(route);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("Email address").fill(adminCredentials.email);
  await page.getByLabel("Password").fill(adminCredentials.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const escapedRoute = route.replaceAll("/", "\/");
  await expect(page).toHaveURL(new RegExp("^https?://[^/]+" + escapedRoute + "$"));
}

for (const route of ["/en/hostel", "/ur/hostel"] as const) {
  test("authenticated admin can open " + route, async ({ page }) => {
    test.skip(!process.env.CI, "Authenticated Hostel acceptance runs in isolated staging CI.");

    await signInForRoute(page, route);

    if (route === "/en/hostel") {
      await expect(page.getByRole("heading", { name: "Hostel & Mess operations" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Add hostel" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Visitor check-in" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Meal service" })).toBeVisible();
      await expect(page.getByText("E2E Student", { exact: true })).toBeVisible();
      await expect(page.getByText("E2E Visitor", { exact: true })).toBeVisible();
      await expect(page.getByText("E2E Hostel", { exact: true })).toBeVisible();
      await expect(page.getByText("E2E Mess", { exact: true })).toBeVisible();
      return;
    }

    await expect(page.getByRole("heading", { name: "ہاسٹل اور میس آپریشنز" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ہاسٹل شامل کریں" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "وزیٹر چیک اِن" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "میل سروس" })).toBeVisible();
    await expect(page.getByText("E2E Student", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E Visitor", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E Hostel", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E Mess", { exact: true })).toBeVisible();
  });
}

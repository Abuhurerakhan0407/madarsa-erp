import { expect, test } from "@playwright/test";

const PROTECTED_ROUTES = [
  "/en",
  "/en/admissions",
  "/en/admissions/enquiries",
  "/en/admissions/1",
  "/en/students",
  "/en/students/1",
  "/en/students/lifecycle",
  "/en/students/id-cards",
  "/en/people-academics",
  "/en/attendance",
  "/en/attendance/devices",
  "/en/quran",
  "/en/quran/revision",
  "/en/exams",
  "/en/portals",
  "/en/hostel",
  "/en/transport",
  "/en/staff",
  "/en/staff/attendance",
  "/en/staff/leave",
  "/en/library",
  "/en/documents",
  "/en/reports",
  "/en/communications/whatsapp",
  "/en/access",
  "/en/settings/configuration"
] as const;

const AUTHENTICATED_DEMO_AND_LEGACY_ROUTES = [
  "/en/demo",
  "/en/demo/transport",
  "/en/demo/operations",
  "/en/demo/hostel",
  "/en/demo/library",
  "/en/demo/branches",
  "/en/demo/academics",
  "/en/demo/donations",
  "/en/demo/fees",
  "/en/demo/ai"
] as const;

function expectedLoginPattern(route: string): RegExp {
  return new RegExp(`/login\\?next=${encodeURIComponent(route)}$`);
}

for (const route of PROTECTED_ROUTES) {
  test(`redirects anonymous access for ${route} to sign in`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(expectedLoginPattern(route));
  });
}

for (const route of AUTHENTICATED_DEMO_AND_LEGACY_ROUTES) {
  test(`redirects anonymous access for ${route} to sign in`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(expectedLoginPattern(route));
  });
}

test("preserves supported localized protected routes in the post-login next target", async ({ page }) => {
  await page.goto("/ur/students");
  await expect(page).toHaveURL(expectedLoginPattern("/ur/students"));
});

test("normalizes legacy Arabic routes to English before authentication", async ({ page }) => {
  await page.goto("/ar/admissions");
  await expect(page).toHaveURL(expectedLoginPattern("/en/admissions"));
});

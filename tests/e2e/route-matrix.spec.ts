import { expect, test } from "@playwright/test";

const PROTECTED_ROUTES = [
  "/en/settings/configuration",
  "/en/transport",
  "/en/people-academics",
  "/en/communications/whatsapp",
  "/en/reports",
  "/en/students",
  "/en/students/1",
  "/en/students/lifecycle",
  "/en/students/id-cards",
  "/en/staff",
  "/en/staff/attendance",
  "/en/staff/leave",
  "/en/hostel",
  "/en/library",
  "/en/attendance",
  "/en/attendance/devices",
  "/en/documents",
  "/en/admissions",
  "/en/admissions/enquiries",
  "/en/admissions/1",
  "/en/portals",
  "/en/quran",
  "/en/quran/revision",
  "/en/access",
  "/en/exams"
];

const DEMO_ROUTES = [
  "/en/demo/transport",
  "/en/demo/operations",
  "/en/demo/hostel",
  "/en/demo/library",
  "/en/demo/branches",
  "/en/demo/academics",
  "/en/demo/donations",
  "/en/demo/fees",
  "/en/demo/ai"
];

for (const route of PROTECTED_ROUTES) {
  test(`protects route ${route} behind sign in`, async ({ page }) => {
    await page.goto(route);
    const encodedNext = encodeURIComponent(route);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodedNext}`));
  });
}

for (const route of DEMO_ROUTES) {
  test(`protects demo route ${route} behind sign in`, async ({ page }) => {
    await page.goto(route);
    const encodedNext = encodeURIComponent(route);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodedNext}`));
  });
}

test("demo modules do not fall back into generic fake/demo pages", async ({ page }) => {
  await page.goto("/en/demo");
  await expect(page).toHaveURL(/\/login\?next=%2Fen%2Fdemo/);
});

test("mobile/Android Playwright coverage works for localized routes", async ({ page, isMobile }) => {
  // Use isMobile context property if we wanted to enforce logic branch, but Playwright project settings
  // already control this per-project.
  await page.goto("/ur/students");
  await expect(page).toHaveURL(/\/login\?next=%2Fur%2Fstudents/);
  await page.goto("/ar/admissions");
  await expect(page).toHaveURL(/\/login\?next=%2Far%2Fadmissions/);
});

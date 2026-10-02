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
  "/en/programs",
  "/en/people-academics",
  "/en/my-students",
  "/en/attendance",
  "/en/attendance/devices",
  "/en/quran",
  "/en/quran/revision",
  "/en/exams",
  "/en/portals",
  "/en/staff",
  "/en/staff/attendance",
  "/en/staff/leave",
  "/en/documents",
  "/en/reports",
  "/en/fees",
  "/en/contributions",
  "/en/payroll",
  "/en/assistant",
  "/en/access",
  "/en/hostel",
  "/en/settings/configuration"
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

test("preserves localized protected routes in the post-login next target", async ({ page }) => {
  for (const route of ["/ur/students", "/ur/admissions", "/ur/hostel"] as const) {
    await page.goto(route);
    await expect(page).toHaveURL(expectedLoginPattern(route));
  }
});

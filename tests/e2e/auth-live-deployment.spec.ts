import { expect, test, type Page } from "@playwright/test";
import { provisionStagingRoleUsers } from "./staging-provision";

type Credential = { email: string; password: string; username?: string };
type Role = "admin" | "teacher" | "parent";

const QA_URL = "https://madarsa-erp-git-qa-hoste-75a40a-iamabuhurerakhan-1107s-projects.vercel.app";
const STAGING_URL = "https://loihcxyblzdfiogrdihm.supabase.co";
const clean = (value: string | undefined) => (value ?? "").trim().replace(/^['"]|['"]$/g, "");
const appBaseUrl = clean(process.env.E2E_APP_URL).replace(/\/$/, "");
const configuredStagingUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/$/, "");

let credentials: Record<Role, Credential> = {
  admin: { email: "", password: "" },
  teacher: { email: "", password: "" },
  parent: { email: "", password: "" },
};

async function signInOnQA(page: Page, role: "Parent" | "Teacher", username: string, password: string) {
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "en", url: QA_URL },
  ]);
  const loginPage = await page.goto(`${QA_URL}/login?next=%2Fportal`);
  expect(loginPage?.status(), "QA login page did not load").toBe(200);
  await page.getByLabel("Email or username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);

  const [response] = await Promise.all([
    page.waitForResponse((item) =>
      item.url().includes("/api/auth/login") && item.request().method() === "POST"
    ),
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  ]);
  expect(response.status(), "deployed login API rejected the valid QA credential").toBe(200);
  await expect(response.json()).resolves.toEqual({ signedIn: true });

  // The API response and client-side router navigation are separate async steps.
  // Wait for the protected route transition before the role-specific assertions.
  await page.waitForURL((url) => url.pathname !== "/login");
}

test.describe("deployed QA username authentication", () => {
  test.skip(
    !process.env.CI || appBaseUrl !== QA_URL || configuredStagingUrl !== STAGING_URL,
    "This suite runs only in CI when the target is the exact QA deployment and staging Supabase project."
  );
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({}, testInfo) => {
    const runId = process.env.GITHUB_RUN_ID || "local";
    const attempt = process.env.GITHUB_RUN_ATTEMPT || "1";
    const projectKey = testInfo.project.name === "chromium" ? "chr" : "and";
    const suffix =
      "ci-" + runId + "-a" + attempt + "-la-" + projectKey +
      "-r" + testInfo.retry + "-w" + testInfo.workerIndex;

    const provisioned = await provisionStagingRoleUsers(suffix);
    credentials = provisioned.credentials;

    expect(credentials.parent.email).toMatch(/@parents\.ilmgaah\.in$/);
    expect(credentials.parent.username).toMatch(/^PAR-[0-9]{6}$/);
    expect(credentials.teacher.email).toBeTruthy();
    expect(credentials.teacher.username).toMatch(/^UST-[0-9]{6}$/);
    expect(credentials.parent.password).toBeTruthy();
    expect(credentials.teacher.password).toBeTruthy();
  });

  test("Parent and Teacher email identifiers and wrong passwords are rejected by the deployed login API", async ({ request }) => {
    const badPassword = "Wrong-QA-Password-Not-Real-026!";
    const cases = [
      { name: "parent email", identifier: credentials.parent.email, password: credentials.parent.password },
      { name: "teacher email", identifier: credentials.teacher.email, password: credentials.teacher.password },
      { name: "parent username with wrong password", identifier: credentials.parent.username ?? "", password: badPassword },
      { name: "teacher username with wrong password", identifier: credentials.teacher.username ?? "", password: badPassword },
    ];

    for (const item of cases) {
      const response = await request.post(`${QA_URL}/api/auth/login`, {
        headers: {
          origin: QA_URL,
          referer: `${QA_URL}/login`,
          "content-type": "application/json",
        },
        data: { identifier: item.identifier, password: item.password },
        timeout: 20_000,
      });
      expect(response.status(), `${item.name} should be rejected generically`).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "invalid_credentials" });
      expect(response.headers()["cache-control"] ?? "").toMatch(/no-store/i);
      expect(response.headers()["set-cookie"] ?? "").toBe("");
    }
  });

  test("Parent username login creates a server session and enforces the first-login password-change gate", async ({ page }) => {
    await signInOnQA(page, "Parent", credentials.parent.username ?? "", credentials.parent.password);
    await expect.poll(() => new URL(page.url()).pathname).toContain("/portal/change-password");
    await expect.poll(() => new URL(page.url()).pathname).not.toContain("/login");

    await page.reload();
    await expect.poll(() => new URL(page.url()).pathname).toContain("/portal/change-password");
    await expect.poll(() => new URL(page.url()).pathname).not.toContain("/login");
  });

  test("Teacher username login persists across reload and logout clears the browser session", async ({ page }) => {
    await signInOnQA(page, "Teacher", credentials.teacher.username ?? "", credentials.teacher.password);
    await expect.poll(() => new URL(page.url()).pathname).toBe("/portal");
    await expect(page.locator("details.account-menu")).toBeVisible();

    await page.reload();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/portal");
    await expect(page.locator("details.account-menu")).toBeVisible();

    await page.locator("details.account-menu > summary").click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/login\?next=/);

    await page.goto(`${QA_URL}/portal`);
    await expect(page).toHaveURL(/\/login\?next=%2Fportal|\/login\?next=%252Fportal/);
  });
});

import { expect, test } from "@playwright/test";

test("protects the root workspace behind sign in", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login\?next=%2F$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("protects localized institution routes", async ({ page }) => {
  await page.goto("/ur");
  await expect(page).toHaveURL(/\/login\?next=%2Fur$/);

  await page.goto("/ar/settings/configuration");
  await expect(page).toHaveURL(/\/login\?next=%2Far%2Fsettings%2Fconfiguration$/);
});

test("protects onboarding until an identity is authenticated", async ({ page }) => {
  await page.goto("/onboarding");

  await expect(page).toHaveURL(/\/login\?next=%2Fonboarding$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("renders accessible sign in and signup modes", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByLabel("Email address")).toHaveAttribute("type", "email");
  await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
  await expect(page.getByLabel("Password")).toHaveAttribute("minlength", "8");

  await page.getByRole("button", { name: "New institution? Create an account" }).click();
  await expect(
    page.getByRole("heading", { name: "Create your institution account" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});

test("health endpoint remains public", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({
    status: "ok",
    service: "madarsa-erp"
  });
});

test("tenant bootstrap rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/onboarding/bootstrap", {
    headers: { "content-type": "application/json" },
    data: {
      displayName: "Test Owner",
      institutionName: "Test Institution",
      slug: "test-institution",
      branchName: "Main Branch",
      branchCode: "MAIN"
    }
  });

  expect(response.status()).toBe(401);
});

test("tenant bootstrap rejects cross-origin mutation attempts first", async ({ request }) => {
  const response = await request.post("/api/onboarding/bootstrap", {
    headers: {
      "content-type": "application/json",
      origin: "https://attacker.example"
    },
    data: {
      displayName: "Test Owner",
      institutionName: "Test Institution",
      slug: "test-institution",
      branchName: "Main Branch",
      branchCode: "MAIN"
    }
  });

  expect(response.status()).toBe(403);
});

test("configuration preset drafts reject anonymous callers", async ({ request }) => {
  const response = await request.post("/api/configuration/preset", {
    headers: { "content-type": "application/json" },
    data: { presetKey: "maktab" }
  });

  expect(response.status()).toBe(401);
});

test("configuration preset drafts reject cross-origin callers first", async ({ request }) => {
  const response = await request.post("/api/configuration/preset", {
    headers: {
      "content-type": "application/json",
      origin: "https://attacker.example"
    },
    data: { presetKey: "maktab" }
  });

  expect(response.status()).toBe(403);
});

test("configuration preset drafts require JSON", async ({ request }) => {
  const response = await request.post("/api/configuration/preset", {
    headers: { "content-type": "text/plain" },
    data: "maktab"
  });

  expect(response.status()).toBe(415);
});

import { expect, test } from "@playwright/test";

test("renders the public Ilmgaah homepage", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Run the institution. Keep the calm." })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Request a Free Demo by email" }).first()
  ).toHaveAttribute("href", /^mailto:shalconintelligence@gmail\.com\?subject=Ilmgaah%20Free%20Demo%20Request/);
});

test("protects localized institution routes", async ({ page }) => {
  await page.goto("/ur");
  await expect(page).toHaveURL(/\/login\?next=%2Fur$/);

  await page.goto("/ur/settings/configuration");
  await expect(page).toHaveURL(/\/login\?next=%2Fur%2Fsettings%2Fconfiguration$/);

  await page.goto("/en/programs");
  await expect(page).toHaveURL(/\/login\?next=%2Fen%2Fprograms$/);
});

test("protects onboarding until an identity is authenticated", async ({ page }) => {
  await page.context().addCookies([
    {
      name: "NEXT_LOCALE",
      value: "en",
      domain: "localhost",
      path: "/"
    }
  ]);
  await page.goto("/onboarding");

  await expect(page).toHaveURL(/\/login\?next=%2Fonboarding$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("renders accessible sign in and signup modes", async ({ page }) => {
  await page.context().addCookies([
    {
      name: "NEXT_LOCALE",
      value: "en",
      domain: "localhost",
      path: "/"
    }
  ]);
  await page.goto("/login");

  await expect(page.getByLabel("Email address")).toHaveAttribute("type", "email");
  await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
  await expect(page.getByLabel("Password")).toHaveAttribute("minlength", "8");

  await expect(page.getByText("Admissions", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Qur'an / Hifz", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Fees", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/finance/i)).toHaveCount(0);

  await page.getByRole("button", { name: "اردو" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ur");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByLabel("ای میل")).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

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
    service: "ilmgaah"
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

test("admissions foundation rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/admissions/foundation", {
    headers: { "content-type": "application/json" },
    data: {
      sessionKey: "2026_27",
      sessionLabels: { en: "2026-27", ur: "تعلیمی سال" },
      startsOn: "2026-06-01",
      endsOn: "2027-05-31",
      programKey: "dars_e_nizami",
      programLabels: { en: "Dars-e-Nizami", ur: "درس نظامی" },
      programType: "dars_e_nizami"
    }
  });

  expect(response.status()).toBe(401);
});

test("admissions foundation rejects cross-origin callers first", async ({ request }) => {
  const response = await request.post("/api/admissions/foundation", {
    headers: {
      "content-type": "application/json",
      origin: "https://attacker.example"
    },
    data: {}
  });

  expect(response.status()).toBe(403);
});

test("admissions foundation requires JSON", async ({ request }) => {
  const response = await request.post("/api/admissions/foundation", {
    headers: { "content-type": "text/plain" },
    data: "setup"
  });

  expect(response.status()).toBe(415);
});

test("public admission submission requires a browser origin", async ({ request }) => {
  const response = await request.post("/api/public/admissions/test-institution/submit", {
    headers: { "content-type": "application/json" },
    data: {}
  });

  expect(response.status()).toBe(403);
});

test("public admission submission rejects cross-origin callers", async ({ request }) => {
  const response = await request.post("/api/public/admissions/test-institution/submit", {
    headers: {
      "content-type": "application/json",
      origin: "https://attacker.example"
    },
    data: {}
  });

  expect(response.status()).toBe(403);
});

test("public admission submission requires JSON before database access", async ({ request }) => {
  const response = await request.post("/api/public/admissions/test-institution/submit", {
    headers: {
      "content-type": "text/plain",
      origin: "http://localhost:3000"
    },
    data: "application"
  });

  expect(response.status()).toBe(415);
});

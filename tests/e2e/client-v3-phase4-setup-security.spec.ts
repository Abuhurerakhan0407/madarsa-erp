import { expect, test } from "@playwright/test";

test("guided setup stays protected behind sign in", async ({ page }) => {
  await page.goto("/en/setup");
  await expect(page).toHaveURL(/\/login\?next=%2Fen%2Fsetup$/);
});

test("institution profile update blocks cross-origin callers before authentication", async ({ request }) => {
  const response = await request.post("/api/institution/profile", {
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    data: {
      displayName: "Example Institution",
      timezone: "Asia/Kolkata",
      primaryLocale: "en",
      supportedLocales: ["en"]
    }
  });
  expect(response.status()).toBe(403);
});

test("institution profile update requires authentication", async ({ request }) => {
  const response = await request.post("/api/institution/profile", {
    headers: { "content-type": "application/json" },
    data: {
      displayName: "Example Institution",
      timezone: "Asia/Kolkata",
      primaryLocale: "en",
      supportedLocales: ["en"]
    }
  });
  expect(response.status()).toBe(401);
});

test("institution profile release locale validation rejects Arabic", async ({ request }) => {
  const primaryArabic = await request.post("/api/institution/profile", {
    headers: { "content-type": "application/json" },
    data: { displayName: "Example Institution", timezone: "Asia/Kolkata", primaryLocale: "ar", supportedLocales: ["ar"] }
  });
  expect(primaryArabic.status()).toBe(400);

  const supportedArabic = await request.post("/api/institution/profile", {
    headers: { "content-type": "application/json" },
    data: { displayName: "Example Institution", timezone: "Asia/Kolkata", primaryLocale: "en", supportedLocales: ["en", "ar"] }
  });
  expect(supportedArabic.status()).toBe(400);
});

test("institution profile release locale validation accepts English and Urdu", async ({ request }) => {
  for (const locale of ["en", "ur"]) {
    const response = await request.post("/api/institution/profile", {
      headers: { "content-type": "application/json" },
      data: { displayName: "Example Institution", timezone: "Asia/Kolkata", primaryLocale: locale, supportedLocales: [locale] }
    });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required." });
  }
});

test("academic group creation blocks cross-origin callers before authentication", async ({ request }) => {
  const response = await request.post("/api/academics/groups", {
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    data: { sessionId: 1, programId: 1, key: "class_a", labels: { en: "Class A" } }
  });
  expect(response.status()).toBe(403);
});

test("academic group creation requires authentication", async ({ request }) => {
  const response = await request.post("/api/academics/groups", {
    headers: { "content-type": "application/json" },
    data: { sessionId: 1, programId: 1, key: "class_a", labels: { en: "Class A" } }
  });
  expect(response.status()).toBe(401);
});

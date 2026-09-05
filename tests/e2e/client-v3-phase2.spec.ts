import { expect, test } from "@playwright/test";

test("Client V3 walk-in admission stays protected behind sign in", async ({ page }) => {
  await page.goto("/ur/students/new");
  await expect(page).toHaveURL(/\/login\?next=%2Fur%2Fstudents%2Fnew$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("walk-in admission API rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/admissions/walk-in", {
    headers: { "content-type": "application/json" },
    data: {
      displayName: "Ahmed Khan",
      ageYears: 11,
      preferredLocale: "ur",
      sessionId: 1,
      programId: 1,
      groupId: 2,
      guardian: { name: "Yusuf Khan", relationship: "father", phone: "+919876543210" }
    }
  });
  expect(response.status()).toBe(401);
});

test("walk-in admission API rejects cross-origin mutations before authentication", async ({ request }) => {
  const response = await request.post("/api/admissions/walk-in", {
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    data: { displayName: "Ahmed Khan" }
  });
  expect(response.status()).toBe(403);
});

test("simple admission actions reject anonymous callers", async ({ request }) => {
  const response = await request.post("/api/admissions/simple-action", {
    headers: { "content-type": "application/json" },
    data: { applicationId: 1, action: "accept" }
  });
  expect(response.status()).toBe(401);
});

test("simple admission actions reject cross-origin mutations first", async ({ request }) => {
  const response = await request.post("/api/admissions/simple-action", {
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    data: { applicationId: 1, action: "reject", reason: "Not eligible" }
  });
  expect(response.status()).toBe(403);
});

test("legacy completion details reject anonymous callers", async ({ request }) => {
  const response = await request.post("/api/admissions/complete-details", {
    headers: { "content-type": "application/json" },
    data: {
      applicationId: 1,
      nativeName: "احمد خان",
      gender: "male",
      guardianName: "Yusuf Khan",
      guardianRelationship: "father",
      guardianPhone: "+919876543210",
      guardianEmail: "guardian@example.com",
      groupKey: "dars_year_1_a",
      joiningDate: "2026-09-05"
    }
  });
  expect(response.status()).toBe(401);
});

test("legacy completion details reject cross-origin mutations first", async ({ request }) => {
  const response = await request.post("/api/admissions/complete-details", {
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    data: { applicationId: 1 }
  });
  expect(response.status()).toBe(403);
});

test("staff admission photo attachment rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/admissions/photo", {
    multipart: {
      applicationId: "1",
      photo: {
        name: "student.png",
        mimeType: "image/png",
        buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
      }
    }
  });
  expect(response.status()).toBe(401);
});

test("staff admission photo attachment rejects cross-origin uploads first", async ({ request }) => {
  const response = await request.post("/api/admissions/photo", {
    headers: { origin: "https://attacker.example" },
    multipart: { applicationId: "1" }
  });
  expect(response.status()).toBe(403);
});

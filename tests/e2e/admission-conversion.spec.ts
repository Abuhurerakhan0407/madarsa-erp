import { expect, test } from "@playwright/test";

test("admission conversion rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/admissions/convert", {
    headers: { "content-type": "application/json" },
    data: { applicationId: 1 }
  });

  expect(response.status()).toBe(401);
});

test("admission conversion rejects cross-origin mutation attempts first", async ({ request }) => {
  const response = await request.post("/api/admissions/convert", {
    headers: {
      "content-type": "application/json",
      origin: "https://attacker.example"
    },
    data: { applicationId: 1 }
  });

  expect(response.status()).toBe(403);
});

test("admission conversion requires JSON before authentication", async ({ request }) => {
  const response = await request.post("/api/admissions/convert", {
    headers: { "content-type": "text/plain" },
    data: "1"
  });

  expect(response.status()).toBe(415);
});

test("admission conversion rejects unsupported client authority fields", async ({ request }) => {
  const response = await request.post("/api/admissions/convert", {
    headers: { "content-type": "application/json" },
    data: { applicationId: 1, tenantId: 999, personId: 999 }
  });

  expect(response.status()).toBe(401);
});

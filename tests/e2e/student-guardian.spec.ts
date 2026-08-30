import { expect, test } from "@playwright/test";

test("student guardian update rejects anonymous callers", async ({ request }) => {
  const response = await request.put("/api/students/4/guardian", {
    headers: { "content-type": "application/json" },
    data: { name: "Guardian", relationship: "father", canCollect: true }
  });
  expect(response.status()).toBe(401);
});

test("student guardian update blocks cross-origin mutations first", async ({ request }) => {
  const response = await request.put("/api/students/4/guardian", {
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    data: { name: "Guardian", relationship: "father", canCollect: true }
  });
  expect(response.status()).toBe(403);
});

test("student guardian update requires JSON before authentication", async ({ request }) => {
  const response = await request.put("/api/students/4/guardian", {
    headers: { "content-type": "text/plain" },
    data: "guardian"
  });
  expect(response.status()).toBe(415);
});

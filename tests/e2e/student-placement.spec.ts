import { expect, test } from "@playwright/test";

test("student placement rejects anonymous callers", async ({ request }) => {
  const response = await request.put("/api/students/4/placement", {
    headers: { "content-type": "application/json" },
    data: { groupId: 2, reason: "test" }
  });
  expect(response.status()).toBe(401);
});

test("student placement blocks cross-origin mutations first", async ({ request }) => {
  const response = await request.put("/api/students/4/placement", {
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    data: { groupId: 2 }
  });
  expect(response.status()).toBe(403);
});

test("student placement requires JSON before authentication", async ({ request }) => {
  const response = await request.put("/api/students/4/placement", {
    headers: { "content-type": "text/plain" },
    data: "2"
  });
  expect(response.status()).toBe(415);
});

import { expect, test } from "@playwright/test";

test("Furkania bootstrap rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/client/furkania/bootstrap", {
    headers: { "content-type": "application/json" }
  });

  expect(response.status()).toBe(401);
});

test("Furkania bootstrap rejects cross-origin callers before authentication", async ({ request }) => {
  const response = await request.post("/api/client/furkania/bootstrap", {
    headers: {
      "content-type": "application/json",
      origin: "https://attacker.example"
    }
  });

  expect(response.status()).toBe(403);
});

import { expect, test } from "@playwright/test";

for (const endpoint of [
  "/api/communications/whatsapp/config",
  "/api/communications/whatsapp/templates",
  "/api/communications/whatsapp/consent",
  "/api/communications/whatsapp/queue"
]) {
  test(`${endpoint} rejects anonymous writes`, async ({ request }) => {
    const response = await request.post(endpoint, { data: {} });
    expect(response.status()).toBe(401);
    expect(response.headers()["content-type"]).toContain("application/json");
  });
}

import { expect, test } from "@playwright/test";

const sameOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000").origin;

const validPayload = {
  pattern: "STU-{BRANCH}-{SESSION}-{SEQ}",
  startValue: 1,
  padding: 5,
  resetPeriod: "session"
};

test.describe("student numbering API security", () => {
  test("blocks cross-origin mutation before authentication", async ({ request }) => {
    const response = await request.post("/api/configuration/student-numbering", {
      headers: {
        origin: "https://example.invalid",
        "content-type": "application/json"
      },
      data: validPayload
    });

    expect(response.status()).toBe(403);
  });

  test("requires JSON mutation requests", async ({ request }) => {
    const response = await request.post("/api/configuration/student-numbering", {
      headers: {
        origin: sameOrigin,
        "content-type": "text/plain"
      },
      data: JSON.stringify(validPayload)
    });

    expect(response.status()).toBe(415);
  });

  test("requires an authenticated tenant member", async ({ request }) => {
    const response = await request.post("/api/configuration/student-numbering", {
      headers: {
        origin: sameOrigin,
        "content-type": "application/json"
      },
      data: validPayload
    });

    expect(response.status()).toBe(401);
  });
});

import { expect, test } from "@playwright/test";

test("bulk ID-card PDF rejects anonymous callers", async ({ request }) => {
  const response = await request.get("/api/students/id-cards/pdf?session=1&group=2&student=4");
  expect(response.status()).toBe(401);
});

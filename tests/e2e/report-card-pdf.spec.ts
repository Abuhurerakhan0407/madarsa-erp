import { expect, test } from "@playwright/test";

test("report card PDF rejects anonymous callers", async ({ request }) => {
  const response = await request.get("/api/exams/report-card/4/pdf");
  expect(response.status()).toBe(401);
  expect(response.headers()["content-type"]).toContain("application/json");
});

test("report card PDF rejects an invalid anonymous student without leaking availability", async ({ request }) => {
  const response = await request.get("/api/exams/report-card/not-a-student/pdf");
  expect(response.status()).toBe(401);
});

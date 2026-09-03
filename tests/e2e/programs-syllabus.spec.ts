import { expect, test } from "@playwright/test";

const validPayload = {
  action: "create_program",
  key: "deeniyat_test",
  labels: { en: "Deeniyat Test" },
  descriptions: { en: "Boundary-test payload only" },
  programType: "custom",
  templateKey: "blank_custom"
};

test("Programs & Syllabus mutation rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/programs", {
    headers: { "content-type": "application/json" },
    data: validPayload
  });
  expect(response.status()).toBe(401);
});

test("Programs & Syllabus mutation rejects cross-origin attempts first", async ({ request }) => {
  const response = await request.post("/api/programs", {
    headers: {
      "content-type": "application/json",
      origin: "https://attacker.example"
    },
    data: validPayload
  });
  expect(response.status()).toBe(403);
});

test("Programs & Syllabus mutation requires JSON", async ({ request }) => {
  const response = await request.post("/api/programs", {
    headers: { "content-type": "text/plain" },
    data: "create_program"
  });
  expect(response.status()).toBe(415);
});

test("Programs & Syllabus validates payload before authentication", async ({ request }) => {
  const response = await request.post("/api/programs", {
    headers: { "content-type": "application/json" },
    data: { ...validPayload, templateKey: "not_a_template" }
  });
  expect(response.status()).toBe(400);
});

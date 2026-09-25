import { expect, test } from "@playwright/test";

const body = {
  documentType: "student_id_card",
  locale: "en",
  personIds: [1],
  allFiltered: false,
  inline: false,
  requestKey: "documents-pdf-e2e-request-0001",
  filters: {}
};

test("documents PDF rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/documents/pdf", {
    headers: { "content-type": "application/json" },
    data: body
  });
  expect(response.status()).toBe(401);
});

test("documents PDF blocks cross-origin mutation before auth", async ({ request }) => {
  const response = await request.post("/api/documents/pdf", {
    headers: {
      "content-type": "application/json",
      origin: "https://attacker.example"
    },
    data: body
  });
  expect(response.status()).toBe(403);
});

test("documents PDF requires JSON before auth", async ({ request }) => {
  const response = await request.post("/api/documents/pdf", {
    headers: { "content-type": "text/plain" },
    data: "invalid"
  });
  expect(response.status()).toBe(415);
});

import { expect, test } from "@playwright/test";

const validPayload = {
  action: "create_slot",
  key: "period_test",
  labels: { en: "Period Test" },
  startsAt: "08:00",
  endsAt: "08:45",
  sequence: 99
};

test("Academics mutation rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/academics", { headers: { "content-type": "application/json" }, data: validPayload });
  expect(response.status()).toBe(401);
});

test("Academics mutation blocks cross-origin attempts first", async ({ request }) => {
  const response = await request.post("/api/academics", { headers: { "content-type": "application/json", origin: "https://attacker.example" }, data: validPayload });
  expect(response.status()).toBe(403);
});

test("Academics mutation validates the payload before authentication", async ({ request }) => {
  const response = await request.post("/api/academics", { headers: { "content-type": "application/json" }, data: { ...validPayload, endsAt: "07:00" } });
  expect(response.status()).toBe(400);
});

test("Academic attachment endpoint requires multipart before authentication", async ({ request }) => {
  const response = await request.post("/api/academics/attachment", { headers: { "content-type": "application/json" }, data: { kind: "homework" } });
  expect(response.status()).toBe(415);
});

test("Academic attachment endpoint blocks cross-origin attempts", async ({ request }) => {
  const response = await request.post("/api/academics/attachment", { headers: { "content-type": "multipart/form-data; boundary=test", origin: "https://attacker.example" }, data: "--test--" });
  expect(response.status()).toBe(403);
});

import { expect, test } from "@playwright/test";

test("direct student creation rejects anonymous callers", async ({ request }) => {
  const response = await request.post("/api/students", {
    headers: { "content-type": "application/json" },
    data: { displayName: "Test Student", preferredLocale: "en", sessionId: 1, programId: 1 }
  });
  expect(response.status()).toBe(401);
});

test("direct student creation blocks cross-origin mutations before auth", async ({ request }) => {
  const response = await request.post("/api/students", {
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    data: { displayName: "Test Student", preferredLocale: "en", sessionId: 1, programId: 1 }
  });
  expect(response.status()).toBe(403);
});

test("direct student creation requires JSON before auth", async ({ request }) => {
  const response = await request.post("/api/students", { headers: { "content-type": "text/plain" }, data: "student" });
  expect(response.status()).toBe(415);
});

test("student update rejects anonymous callers", async ({ request }) => {
  const response = await request.patch("/api/students/4", {
    headers: { "content-type": "application/json" },
    data: { displayName: "Test Student", preferredLocale: "en" }
  });
  expect(response.status()).toBe(401);
});

test("student update blocks cross-origin mutations before auth", async ({ request }) => {
  const response = await request.patch("/api/students/4", {
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    data: { displayName: "Test Student", preferredLocale: "en" }
  });
  expect(response.status()).toBe(403);
});

test("student guardian update rejects anonymous callers", async ({ request }) => {
  const response = await request.put("/api/students/4/guardian", {
    headers: { "content-type": "application/json" },
    data: { name: "Test Guardian", relationship: "guardian", canCollect: true }
  });
  expect(response.status()).toBe(401);
});

test("student guardian update blocks cross-origin mutations before auth", async ({ request }) => {
  const response = await request.put("/api/students/4/guardian", {
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    data: { name: "Test Guardian", relationship: "guardian", canCollect: true }
  });
  expect(response.status()).toBe(403);
});

test("student guardian update requires JSON before auth", async ({ request }) => {
  const response = await request.put("/api/students/4/guardian", {
    headers: { "content-type": "text/plain" },
    data: "guardian"
  });
  expect(response.status()).toBe(415);
});

test("student register export is private", async ({ request }) => {
  const response = await request.get("/api/students/export?locale=en");
  expect(response.status()).toBe(401);
});

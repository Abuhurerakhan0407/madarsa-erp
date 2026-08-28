import { expect, test } from "@playwright/test";

const routes = [
  ["/api/admissions/enquiries", { applicantName: "Test" }],
  ["/api/admissions/enquiries/followup", { enquiryId: 1 }],
  ["/api/admissions/enquiries/start", { enquiryId: 1 }]
] as const;

for (const [route, data] of routes) {
  test(`${route} rejects anonymous callers`, async ({ request }) => {
    expect((await request.post(route, { headers: { "content-type": "application/json" }, data })).status()).toBe(401);
  });
  test(`${route} rejects cross-origin callers first`, async ({ request }) => {
    expect((await request.post(route, { headers: { "content-type": "application/json", origin: "https://attacker.example" }, data })).status()).toBe(403);
  });
  test(`${route} rejects non-JSON callers before authentication`, async ({ request }) => {
    expect((await request.post(route, { headers: { "content-type": "application/jsonp" }, data: "{}" })).status()).toBe(415);
  });
}

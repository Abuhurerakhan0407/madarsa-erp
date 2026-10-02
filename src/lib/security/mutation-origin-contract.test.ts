import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(process.cwd(), "src/app/api");
const machineChannels = new Set([
  "attendance/device-ingest/route.ts",
  "webhooks/subscriptions/razorpay/route.ts"
]);

function mutationRoutes(dir: string = apiRoot): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return mutationRoutes(path);
    if (entry.name !== "route.ts") return [];
    const source = readFileSync(path, "utf8");
    if (!/export async function (POST|PATCH|PUT|DELETE)/.test(source)) return [];
    return [relative(apiRoot, path).replaceAll("\\", "/")];
  });
}

describe("mutation origin security surface", () => {
  it("requires same-origin protection for browser mutation routes", () => {
    for (const route of mutationRoutes()) {
      if (machineChannels.has(route)) continue;
      const source = readFileSync(join(apiRoot, route), "utf8");
      expect(source, route).toContain("isSameOriginRequest");
    }
  });
  it("keeps device ingest on bounded device-token authentication", () => {
    const source = readFileSync(join(apiRoot, "attendance/device-ingest/route.ts"), "utf8");
    expect(source).toContain('request.headers.get("x-device-token")');
    expect(source).toContain("readBoundedJson(request, 16_384)");
    expect(source).toContain("receiveAttendanceDeviceEvent");
  });

  it("keeps Razorpay webhook on bounded signature authentication", () => {
    const source = readFileSync(join(apiRoot, "webhooks/subscriptions/razorpay/route.ts"), "utf8");
    expect(source).toContain("readBoundedRawBody(request)");
    expect(source).toContain('request.headers.get("x-razorpay-signature")');
    expect(source).toContain("verifyRazorpayWebhookSignature");
  });
});

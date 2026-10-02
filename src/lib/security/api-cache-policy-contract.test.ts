import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const config = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");

describe("API cache policy", () => {
  it("forces every API response to stay private and non-cacheable", () => {
    expect(config).toContain('source: "/api/:path*"');
    expect(config).toContain('{ key: "Cache-Control", value: "private, no-store, max-age=0" }');
  });

  it("applies the API cache rule before the catch-all security headers", () => {
    const apiRule = config.indexOf('source: "/api/:path*"');
    const catchAll = config.indexOf('source: "/(.*)"');
    expect(apiRule).toBeGreaterThan(-1);
    expect(catchAll).toBeGreaterThan(apiRule);
  });
});

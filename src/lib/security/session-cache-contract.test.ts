import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const supabaseProxy = readFileSync(
  resolve(process.cwd(), "src/lib/supabase/proxy.ts"),
  "utf8"
).toLowerCase();
const appProxy = readFileSync(resolve(process.cwd(), "src/proxy.ts"), "utf8").toLowerCase();

describe("session cache header contract", () => {
  it("applies cache headers returned by Supabase SSR", () => {
    expect(supabaseProxy).toContain("setall(cookiestoset, headers)");
    expect(supabaseProxy).toContain("object.entries(headers)");
    expect(supabaseProxy).toContain("response.headers.set");
  });

  it("retains cache headers when proxy creates redirects or locale responses", () => {
    expect(appProxy).toContain('"cache-control"');
    expect(appProxy).toContain('"expires"');
    expect(appProxy).toContain('"pragma"');
    expect(appProxy).toContain("copysessionstate");
  });
});

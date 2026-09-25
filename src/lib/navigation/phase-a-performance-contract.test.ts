import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appNav = readFileSync(
  resolve(process.cwd(), "src/components/app-nav-link.tsx"),
  "utf8"
);
const mobileNav = readFileSync(
  resolve(process.cwd(), "src/components/mobile-navigation.tsx"),
  "utf8"
);
const localeLayout = readFileSync(
  resolve(process.cwd(), "src/app/[locale]/layout.tsx"),
  "utf8"
);
const tenancy = readFileSync(
  resolve(process.cwd(), "src/lib/tenancy/context.ts"),
  "utf8"
);
const globals = readFileSync(
  resolve(process.cwd(), "src/app/globals.css"),
  "utf8"
);

describe("Phase A navigation performance contract", () => {
  it("does not disable framework prefetch for fixed workspace navigation", () => {
    expect(appNav).not.toContain("prefetch={false}");
    expect(mobileNav).not.toContain("prefetch={false}");
  });

  it("starts independent shell work concurrently", () => {
    expect(localeLayout).toContain("Promise.all([");
    expect(localeLayout).toContain("getTenantContext()");
    expect(localeLayout).toContain("getMessages()");
    expect(tenancy).toContain("Promise.all([tenantPromise, profilePromise, scopePromise])");
  });

  it("ships visible route pending feedback in the globally loaded stylesheet", () => {
    expect(globals).toContain("Phase A shared async feedback");
    expect(globals).toContain('a[data-route-pending="true"]');
    expect(globals).toContain("pointer-events: none");
    expect(globals).toContain(".route-loading-track");
  });
});

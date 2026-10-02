import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginForm = readFileSync(resolve(process.cwd(), "src/components/login-form.tsx"), "utf8");
const proxy = readFileSync(resolve(process.cwd(), "src/proxy.ts"), "utf8");
const appEntry = readFileSync(resolve(process.cwd(), "src/app/app-entry/page.tsx"), "utf8");
const routeMemory = readFileSync(resolve(process.cwd(), "src/components/session-route-memory.tsx"), "utf8");

describe("Android app entry routing contract", () => {
  it("routes a fresh app sign-in through the app-entry resolver", () => {
    expect(loginForm).toContain('params.get("source") === "app"');
    expect(loginForm).toContain('return "/app-entry"');
    expect(proxy).toContain('pathname === "/app-entry"');
    expect(proxy).toContain('loginUrl.searchParams.set("source", "app")');
  });

  it("keeps explicit next and new-institution signup higher priority than app-source routing", () => {
    expect(loginForm.indexOf("if (requested)")).toBeLessThan(loginForm.indexOf('mode === "signup"'));
    expect(loginForm.indexOf('mode === "signup"')).toBeLessThan(loginForm.indexOf('params.get("source") === "app"'));
    expect(proxy.indexOf("? safeAuthRedirect(requested)")).toBeLessThan(
      proxy.indexOf('request.nextUrl.searchParams.get("source") === "app"')
    );
  });

  it("restores the last authorized operator route and sends non-operators to the portal", () => {
    expect(appEntry).toContain("getTenantContext()");
    expect(appEntry).toContain('cookieStore.get("ILMGAAH_LAST_ROUTE")');
    expect(appEntry).toContain("resolveOperatorAppDestination");
    expect(appEntry).toContain('redirect(portalHref("/portal", locale))');
    expect(appEntry).not.toContain('redirect("/onboarding")');
  });

  it("records only localized authenticated workspace routes", () => {
    expect(routeMemory).toContain('const COOKIE_NAME = "ILMGAAH_LAST_ROUTE"');
    expect(routeMemory).toContain('/^\\/(en|ur)(?:\\/|$)/');
    expect(routeMemory).toContain("encodeURIComponent(route)");
  });
});

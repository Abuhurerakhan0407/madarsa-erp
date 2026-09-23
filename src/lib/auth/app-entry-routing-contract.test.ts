import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginPage = readFileSync(resolve(process.cwd(), "src/app/login/page.tsx"), "utf8");
const proxy = readFileSync(resolve(process.cwd(), "src/proxy.ts"), "utf8");
const appEntry = readFileSync(resolve(process.cwd(), "src/app/app-entry/page.tsx"), "utf8");

describe("Android app entry routing contract", () => {
  it("routes a fresh app sign-in through the app-entry resolver", () => {
    expect(loginPage).toContain('params.get("source") === "app"');
    expect(loginPage).toContain('return "/app-entry"');
    expect(proxy).toContain('pathname === "/app-entry"');
    expect(proxy).toContain('loginUrl.searchParams.set("source", "app")');
  });

  it("keeps explicit next destinations higher priority than app-source routing", () => {
    expect(loginPage.indexOf("if (requested)")).toBeLessThan(loginPage.indexOf('params.get("source") === "app"'));
    expect(proxy.indexOf("? safeAuthRedirect(requested)")).toBeLessThan(proxy.indexOf('request.nextUrl.searchParams.get("source") === "app"'));
  });

  it("sends operators to the workspace, verified portal users to the portal, and new accounts to onboarding", () => {
    expect(appEntry).toContain("getTenantContext()");
    expect(appEntry).toContain('redirect(`/${locale}`)');
    expect(appEntry).toContain('.from("identity_person_links")');
    expect(appEntry).toContain('.eq("status", "verified")');
    expect(appEntry).toContain('portalHref("/portal", locale');
    expect(appEntry).toContain('redirect("/onboarding")');
  });
});

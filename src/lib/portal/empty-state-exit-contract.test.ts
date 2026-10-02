import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const portalPage = readFileSync(resolve(process.cwd(), "src/app/portal/page.tsx"), "utf8");
const exitButton = readFileSync(resolve(process.cwd(), "src/components/portal-exit-button.tsx"), "utf8");

describe("portal empty-state exit contract", () => {
  it("renders explicit escape actions without exposing legacy claim-code activation", () => {
    expect(portalPage).toContain("<PortalExitButton");
    expect(portalPage).not.toContain("Activate an access code");
    expect(portalPage).not.toContain('portalHref("/portal/claim"');
    expect(portalPage).toContain("Back to home");
    expect(portalPage).toContain("Back to login");
  });

  it("returns institution users to their localized workspace home", () => {
    expect(portalPage).toContain("const workspace = await getTenantContext()");
    expect(portalPage).toContain("homeHref={workspace ? `/${locale}` : null}");
  });

  it("signs out portal-only accounts before returning them to login", () => {
    expect(exitButton).toContain("await supabase.auth.signOut()");
    expect(exitButton).toContain("router.replace(loginHref)");
  });

  it("uses replace navigation so the dead-end portal page is not left behind", () => {
    expect(exitButton).toContain("router.replace(homeHref)");
    expect(exitButton).not.toContain("router.push(");
  });
});

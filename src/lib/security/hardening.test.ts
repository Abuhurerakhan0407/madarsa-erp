import { describe, expect, it } from "vitest";
import { deletionReady, originAllowed, restoreDrillPassed, safeRedirectTarget } from "./hardening";

describe("security hardening", () => {
  it("requires trusted origins for mutations", () => {
    expect(originAllowed("POST", "https://madarsa-erp.vercel.app", ["https://madarsa-erp.vercel.app"])).toBe(true);
    expect(originAllowed("DELETE", "https://evil.example", ["https://madarsa-erp.vercel.app"])).toBe(false);
    expect(originAllowed("GET", null, [])).toBe(true);
  });
  it("blocks external redirects", () => {
    expect(safeRedirectTarget("https://evil.example/x", "https://madarsa-erp.vercel.app")).toBe("/");
    expect(safeRedirectTarget("/en/settings", "https://madarsa-erp.vercel.app")).toBe("/en/settings");
  });
  it("requires cooling, policy, export, and no hold", () => {
    expect(deletionReady({ coolingEnded: true, legalHoldActive: false, policyApproved: true, exportOffered: true })).toBe(true);
    expect(deletionReady({ coolingEnded: true, legalHoldActive: true, policyApproved: true, exportOffered: true })).toBe(false);
  });
  it("enforces pilot recovery targets", () => {
    expect(restoreDrillPassed({ rpoHours: 20, rtoHours: 7, database: true, storage: true, application: true })).toBe(true);
  });
});

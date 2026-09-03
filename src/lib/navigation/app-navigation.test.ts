import { describe, expect, it } from "vitest";
import { CLIENT_PROFILES } from "../capabilities/client-profile";
import { APP_NAV_GROUPS, findNavItem, getVisibleNavigation } from "./app-navigation";

const clientV2TargetOrder = [
  "overview",
  "admissions",
  "students",
  "programs",
  "academics",
  "attendance",
  "quran",
  "exams",
  "portals",
  "staff",
  "certificates",
  "reports",
  "configuration"
];

const clientHiddenKeys = [
  "fees",
  "operations",
  "donations",
  "hostel",
  "transport",
  "library",
  "whatsapp",
  "ai",
  "branches"
];

describe("Phase 1 app navigation", () => {
  it("keeps the Client V2 target navigation in the required order", () => {
    const visible = getVisibleNavigation(CLIENT_PROFILES["client-v2"]);
    expect(visible.flatMap((group) => group.items.map((item) => item.key))).toEqual(clientV2TargetOrder);
  });

  it("keeps reusable modules in the full-product navigation", () => {
    const visibleKeys = getVisibleNavigation(CLIENT_PROFILES["full-product"]).flatMap((group) => group.items.map((item) => item.key));
    for (const key of clientHiddenKeys) expect(visibleKeys).toContain(key);
  });

  it("hides client-disabled modules without deleting their navigation definitions", () => {
    const visibleKeys = getVisibleNavigation(CLIENT_PROFILES["client-v2"]).flatMap((group) => group.items.map((item) => item.key));
    const definedKeys = APP_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.key));
    for (const key of clientHiddenKeys) {
      expect(visibleKeys).not.toContain(key);
      expect(definedKeys).toContain(key);
    }
  });

  it("provides localized labels and concrete routes for target items", () => {
    for (const key of clientV2TargetOrder) {
      const item = findNavItem(key);
      expect(item).toBeDefined();
      expect(item?.labels.en.trim()).not.toBe("");
      expect(item?.labels.ur.trim()).not.toBe("");
      expect(item?.labels.ar.trim()).not.toBe("");
      expect(item?.href("en")).toMatch(/^\/en(?:\/|$)/);
    }
  });
});

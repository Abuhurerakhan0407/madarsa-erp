import { describe, expect, it } from "vitest";
import { CLIENT_PROFILES } from "../capabilities/client-profile";
import { APP_NAV_GROUPS, findNavItem, getVisibleNavigation } from "./app-navigation";

const launchTargetOrder = [
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
  "payroll",
  "fees",
  "donations",
  "operations",
  "certificates",
  "reports",
  "configuration",
  "ai",
  "branches"
];

const retiredKeys = ["hostel", "transport", "library", "whatsapp"];

describe("commercial app navigation", () => {
  it("keeps the locked launch navigation in the required order", () => {
    const visible = getVisibleNavigation(CLIENT_PROFILES["client-v2"]);
    expect(visible.flatMap((group) => group.items.map((item) => item.key))).toEqual(launchTargetOrder);
  });

  it("keeps the same commercial scope under the full-product override", () => {
    const visible = getVisibleNavigation(CLIENT_PROFILES["full-product"]);
    expect(visible.flatMap((group) => group.items.map((item) => item.key))).toEqual(launchTargetOrder);
  });

  it("does not define retired product destinations in app navigation", () => {
    const definedKeys = APP_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.key));
    for (const key of retiredKeys) expect(definedKeys).not.toContain(key);
  });

  it("provides English and Urdu labels with concrete routes for launch items", () => {
    for (const key of launchTargetOrder) {
      const item = findNavItem(key);
      expect(item).toBeDefined();
      expect(item?.labels.en.trim()).not.toBe("");
      expect(item?.labels.ur.trim()).not.toBe("");
      expect(item?.href("en")).toMatch(/^\/en(?:\/|$)/);
      expect(item?.href("ur")).toMatch(/^\/ur(?:\/|$)/);
    }
  });
});

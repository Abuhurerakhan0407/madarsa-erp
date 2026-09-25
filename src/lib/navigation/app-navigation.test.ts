import { describe, expect, it } from "vitest";
import { CLIENT_PROFILES } from "../capabilities/client-profile";
import { APP_NAV_GROUPS, findNavItem, getVisibleNavigation } from "./app-navigation";

const commercialOrder = [
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

const clientV2Order = commercialOrder.filter(
  (key) => !["academics", "payroll", "fees", "donations", "ai"].includes(key)
);

const retiredKeys = ["hostel", "transport", "library", "whatsapp"];

describe("commercial app navigation", () => {
  it("keeps the full-product launch navigation in the required order", () => {
    const visible = getVisibleNavigation(CLIENT_PROFILES["full-product"]);
    expect(visible.flatMap((group) => group.items.map((item) => item.key))).toEqual(
      commercialOrder
    );
  });

  it("applies the client-v2 module visibility contract without reordering the remaining navigation", () => {
    const visible = getVisibleNavigation(CLIENT_PROFILES["client-v2"]);
    expect(visible.flatMap((group) => group.items.map((item) => item.key))).toEqual(
      clientV2Order
    );
  });

  it("does not define retired modules in any product profile", () => {
    for (const profile of Object.values(CLIENT_PROFILES)) {
      const visibleKeys = getVisibleNavigation(profile).flatMap((group) =>
        group.items.map((item) => item.key)
      );
      for (const key of retiredKeys) expect(visibleKeys).not.toContain(key);
    }
    const definedKeys = APP_NAV_GROUPS.flatMap((group) =>
      group.items.map((item) => item.key)
    );
    for (const key of retiredKeys) expect(definedKeys).not.toContain(key);
  });

  it("provides English and Urdu labels and concrete routes for every launch item", () => {
    for (const key of commercialOrder) {
      const item = findNavItem(key);
      expect(item).toBeDefined();
      expect(item?.labels.en.trim()).not.toBe("");
      expect(item?.labels.ur.trim()).not.toBe("");
      expect(item?.href("en")).toMatch(/^\/en(?:\/|$)/);
      expect(item?.href("ur")).toMatch(/^\/ur(?:\/|$)/);
    }
  });
});

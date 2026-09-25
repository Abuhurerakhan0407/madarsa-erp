import { describe, expect, it } from "vitest";
import { CLIENT_PROFILES } from "@/lib/capabilities/client-profile";
import { getClientV3Navigation } from "./client-v3-navigation";

describe("client-v3 navigation", () => {
  it("keeps full-product office navigation intact", () => {
    const nav = getClientV3Navigation("office", CLIENT_PROFILES["full-product"]);
    const keys = [...nav.primary, ...nav.more].map((entry) => entry.key);
    for (const key of ["academics", "fees", "payroll", "contributions", "assistant"]) {
      expect(keys).toContain(key);
    }
  });

  it("removes client-v2 disabled modules from desktop and mobile navigation", () => {
    const nav = getClientV3Navigation("office", CLIENT_PROFILES["client-v2"]);
    const keys = [...nav.primary, ...nav.more, ...nav.mobile].map((entry) => entry.key);
    for (const key of ["academics", "fees", "payroll", "contributions", "assistant"]) {
      expect(keys).not.toContain(key);
    }
    for (const key of ["home", "admissions", "students", "attendance", "quran", "programs", "lifecycle", "reports"]) {
      expect(keys).toContain(key);
    }
  });

  it("uses the simplified import label required by the client profile", () => {
    const nav = getClientV3Navigation("office", CLIENT_PROFILES["client-v2"]);
    const lifecycle = nav.more.find((entry) => entry.key === "lifecycle");
    expect(lifecycle?.labels.en).toBe("Import Students");
    expect(lifecycle?.labels.ur).toBe("طلبہ امپورٹ کریں");
  });
});

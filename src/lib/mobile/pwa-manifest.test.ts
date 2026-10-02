import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("Jamia Islamia Android/PWA release contract", () => {
  it("publishes a standalone full-scope Jamia client manifest", () => {
    const value = manifest();
    expect(value.name).toBe("Jamia Islamia Uloomul Quraan");
    expect(value.short_name).toBe("Jamia Islamia");
    expect(value.start_url).toBe("/login?source=app");
    expect(value.scope).toBe("/");
    expect(value.display).toBe("standalone");
    expect(value.theme_color).toBe("#14734f");
  });

  it("ships required Android icon assets", () => {
    for (const file of [
      "public/icons/icon-192.png",
      "public/icons/icon-512.png",
      "public/icons/maskable-512.png"
    ]) {
      expect(existsSync(resolve(process.cwd(), file))).toBe(true);
    }
  });

  it("keeps a push-capable portal service worker", () => {
    const source = readFileSync(resolve(process.cwd(), "public/portal-sw.js"), "utf8");
    expect(source).toContain('addEventListener("push"');
    expect(source).toContain("showNotification");
    expect(source).toContain('addEventListener("notificationclick"');
  });
});

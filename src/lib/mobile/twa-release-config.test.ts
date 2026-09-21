import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type TwaConfig = {
  packageId: string;
  host: string;
  name: string;
  launcherName: string;
  enableNotifications: boolean;
  startUrl: string;
  iconUrl: string;
  maskableIconUrl?: string;
  signingKey: { path: string; alias: string };
  appVersion: string;
  appVersionCode: number;
  fallbackType: string;
  minSdkVersion: number;
  orientation: string;
};

const config = JSON.parse(
  readFileSync(resolve(process.cwd(), "android/twa-manifest.json"), "utf8")
) as TwaConfig;

describe("Android TWA release configuration", () => {
  it("locks the Ilmgaah Android identity and trusted origin", () => {
    expect(config).toMatchObject({
      packageId: "in.ilmgaah.app",
      host: "www.ilmgaah.in",
      name: "Ilmgaah",
      launcherName: "Ilmgaah",
      startUrl: "/login?source=app",
      enableNotifications: true,
      fallbackType: "customtabs",
      minSdkVersion: 23,
      orientation: "portrait-primary"
    });
  });

  it("uses production-hosted install artwork backed by committed files", () => {
    expect(config.iconUrl).toBe("https://www.ilmgaah.in/icons/icon-512.png");
    expect(config.maskableIconUrl).toBe("https://www.ilmgaah.in/icons/maskable-512.png");
    expect(existsSync(resolve(process.cwd(), "public/icons/icon-192.png"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "public/icons/icon-512.png"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "public/icons/maskable-512.png"))).toBe(true);
  });

  it("keeps release signing material outside source control", () => {
    expect(config.signingKey).toEqual({
      path: "./signing/ilmgaah-release.jks",
      alias: "ilmgaah"
    });
    expect(config.signingKey.path).not.toMatch(/password|secret|token/i);
  });

  it("starts at version 1.0.0 / code 1", () => {
    expect(config.appVersion).toBe("1.0.0");
    expect(config.appVersionCode).toBe(1);
  });
});

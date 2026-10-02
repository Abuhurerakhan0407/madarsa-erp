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
  fingerprints: Array<{ name?: string; value: string }>;
};

const config = JSON.parse(
  readFileSync(resolve(process.cwd(), "android/twa-manifest.json"), "utf8")
) as TwaConfig;

const generatedBuild = readFileSync(
  resolve(process.cwd(), "android/app/build.gradle"),
  "utf8"
);

const launcherActivity = readFileSync(
  resolve(
    process.cwd(),
    "android/app/src/main/java/in/ilmgaah/app/LauncherActivity.java"
  ),
  "utf8"
);

const releaseBuildScript = readFileSync(
  resolve(process.cwd(), "android/build-release.ps1"),
  "utf8"
);

const embeddedWebManifest = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "android/app/src/main/res/raw/web_app_manifest.json"),
    "utf8"
  )
) as { start_url?: string };

describe("Android TWA release configuration", () => {
  it("locks the Jamia Islamia Android identity and trusted origin", () => {
    expect(config).toMatchObject({
      packageId: "in.ilmgaah.app",
      host: "www.ilmgaah.in",
      name: "Jamia Islamia Uloomul Quraan",
      launcherName: "Jamia Islamia",
      startUrl: "/login?source=app",
      enableNotifications: true,
      fallbackType: "webview",
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

  it("keeps the generated native project bound to the production origin", () => {
    expect(generatedBuild).toContain("applicationId: 'in.ilmgaah.app'");
    expect(generatedBuild).toContain("hostName: 'www.ilmgaah.in'");
    expect(generatedBuild).toContain("launchUrl: '/login?source=app'");
    expect(generatedBuild).toContain(
      "resValue \"string\", \"webManifestUrl\", 'https://www.ilmgaah.in/manifest.webmanifest'"
    );
    expect(generatedBuild).not.toMatch(/127\.0\.0\.1|4812[456]/);
    expect(embeddedWebManifest.start_url).toBe("/login?source=app");
  });

  it("uses the Windows-safe pnpm executable in the release script", () => {
    expect(releaseBuildScript).toContain("pnpm.cmd dlx @bubblewrap/cli");
    expect(releaseBuildScript).not.toMatch(/^pnpm dlx /m);
  });

  it("preserves the trusted Chrome provider override", () => {
    expect(launcherActivity).toContain("createTwaLauncher");
    expect(launcherActivity).toContain('new TwaLauncher(this, "com.android.chrome")');
  });

  it("pins the production release fingerprint for Digital Asset Links", () => {
    expect(config.fingerprints).toEqual([
      {
        name: "release",
        value:
          "11:8F:A8:EA:15:49:C3:B2:C9:AD:DF:45:A7:F0:05:5C:F2:77:5E:4E:6A:86:EC:C1:65:89:AA:4A:69:70:20:A7"
      }
    ]);
  });

  it("keeps release signing material outside source control", () => {
    expect(config.signingKey).toEqual({
      path: "./signing/ilmgaah-release.jks",
      alias: "ilmgaah"
    });
    expect(config.signingKey.path).not.toMatch(/password|secret|token/i);
  });

  it("locks client version 1.1.0 / code 4", () => {
    expect(config.appVersion).toBe("1.1.0");
    expect(config.appVersionCode).toBe(4);
  });
});

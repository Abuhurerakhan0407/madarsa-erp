import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const buildGradle = readFileSync(resolve(root, "android/app/build.gradle"), "utf8");
const manifest = readFileSync(resolve(root, "android/app/src/main/AndroidManifest.xml"), "utf8");
const clientConfig = readFileSync(
  resolve(root, "android/app/src/main/java/in/ilmgaah/app/ClientConfig.java"),
  "utf8"
);
const mainActivity = readFileSync(
  resolve(root, "android/app/src/main/java/in/ilmgaah/app/MainActivity.java"),
  "utf8"
);

describe("Android native release configuration", () => {
  it("locks the Jamia native application identity", () => {
    expect(buildGradle).toContain("applicationId 'in.ilmgaah.app'");
    expect(buildGradle).toContain("versionCode 5");
    expect(buildGradle).toContain("versionName '1.2.0'");
    expect(manifest).toContain('android:name=".MainActivity"');
    expect(manifest).toContain('android.permission.INTERNET');
  });
  it("binds the client to the live Ilmgaah API", () => {
    expect(clientConfig).toContain('public static final String API_BASE = "https://www.ilmgaah.in";');
    expect(clientConfig).toContain('Jamia Islamia Uloomul Quraan');
    expect(clientConfig).toContain('public static final String ACADEMIC_YEAR = "2026–2027";');
  });

  it("keeps the native client self-contained", () => {
    expect(mainActivity).toContain("public class MainActivity extends Activity");
    expect(mainActivity).not.toContain("LauncherActivity");
    expect(existsSync(resolve(root, "android/twa-manifest.json"))).toBe(false);
  });

  it("keeps signing material and generated APKs outside source control", () => {
    const gitignore = readFileSync(resolve(root, ".gitignore"), "utf8");
    expect(gitignore).toContain("android/signing/");
    expect(gitignore).toContain("android/*.apk");
  });
});

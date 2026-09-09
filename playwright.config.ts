import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
let serverlessChromiumArgs: string[] = [];
if (process.env.PLAYWRIGHT_CHROMIUM_ARGS) {
  try {
    const parsed = JSON.parse(process.env.PLAYWRIGHT_CHROMIUM_ARGS);
    if (Array.isArray(parsed) && parsed.every((value) => typeof value === "string")) {
      serverlessChromiumArgs = parsed;
    }
  } catch {
    serverlessChromiumArgs = [];
  }
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;
const isExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL && process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3000");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "line" : "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    ...(storageState ? { storageState } : {}),
    ...(executablePath
      ? {
          launchOptions: {
            executablePath,
            args: serverlessChromiumArgs
          }
        }
      : {})
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "android", use: { ...devices["Pixel 7"] } }
  ],
  webServer: isExternalServer
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL:
            process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_e2e_placeholder"
        }
      }
});

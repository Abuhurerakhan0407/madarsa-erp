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

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "line" : "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
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
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      ILMGAAH_E2E_FIXTURES: "1",
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_e2e_placeholder"
    }
  }
});

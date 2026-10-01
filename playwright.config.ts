import { defineConfig, devices } from "@playwright/test";

const ci = Boolean(process.env.CI);
const e2eSupabaseUrl =
  process.env.E2E_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://example.supabase.co";
const e2eSupabaseKey =
  process.env.E2E_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_e2e_placeholder";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 2 : 0,
  reporter: ci ? "line" : "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "android", use: { ...devices["Pixel 7"] } }
  ],
  webServer: {
    command: ci ? "pnpm build && pnpm start" : "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !ci,
    env: {
      ...process.env,
      E2E_SUPABASE_URL: e2eSupabaseUrl,
      E2E_SUPABASE_PUBLISHABLE_KEY: e2eSupabaseKey,
      NEXT_PUBLIC_SUPABASE_URL: e2eSupabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: e2eSupabaseKey
    }
  }
});

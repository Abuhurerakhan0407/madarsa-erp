import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const require = createRequire(import.meta.url);
const chromiumRoot = process.env.SERVERLESS_CHROMIUM_ROOT || "/tmp/pw-serverless/node_modules";
const serverlessChromium = require(`${chromiumRoot}/@sparticuz/chromium`);
const executablePath = await serverlessChromium.executablePath();
const chromiumArgs = serverlessChromium.args.filter((arg) => arg !== "--single-process");
const command = process.platform === "win32" ? "npm.cmd" : "npm";

let result;
try {
  result = spawnSync(command, ["run", "test:e2e"], {
    stdio: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_EXECUTABLE_PATH: executablePath,
      PLAYWRIGHT_CHROMIUM_ARGS: JSON.stringify(chromiumArgs)
    }
  });
} finally {
  // Playwright boots `next dev`, which writes `.next/dev/types` while running.
  // If the dev server is terminated during a write, a partial generated validator
  // can be left behind and then picked up by the final production typecheck.
  // Remove only dev-generated artifacts; `next build` will create production output.
  rmSync(".next/dev", { recursive: true, force: true });
}

if (result?.error) throw result.error;
process.exit(result?.status ?? 1);

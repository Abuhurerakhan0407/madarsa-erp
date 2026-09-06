import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const chromiumRoot = process.env.SERVERLESS_CHROMIUM_ROOT || "/tmp/pw-serverless/node_modules";
const serverlessChromium = require(`${chromiumRoot}/@sparticuz/chromium`);
const executablePath = await serverlessChromium.executablePath();
const chromiumArgs = serverlessChromium.args.filter((arg) => arg !== "--single-process");
const command = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(command, ["run", "test:e2e"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PLAYWRIGHT_EXECUTABLE_PATH: executablePath,
    PLAYWRIGHT_CHROMIUM_ARGS: JSON.stringify(chromiumArgs)
  }
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);

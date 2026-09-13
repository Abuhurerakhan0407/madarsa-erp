import { spawnSync } from "node:child_process";
import serverlessChromium from "@sparticuz/chromium";

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

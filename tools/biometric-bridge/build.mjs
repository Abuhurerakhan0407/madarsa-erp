import { build } from "esbuild";
import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const toolDir = path.resolve("tools/biometric-bridge");
const dist = path.join(toolDir, "dist");
await fsp.rm(dist, { recursive: true, force: true });
await fsp.mkdir(dist, { recursive: true });

await build({
  entryPoints: [path.join(toolDir, "src/agent.mjs")],
  outfile: path.join(dist, "bridge.cjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  sourcemap: false,
  minify: false,
  legalComments: "none",
  logLevel: "warning"
});

await fsp.copyFile(process.execPath, path.join(dist, "node.exe"));
for (const file of ["config.example.json", "install.ps1", "uninstall.ps1", "status.ps1", "README.md"]) {
  await fsp.copyFile(path.join(toolDir, file), path.join(dist, file));
}

const files = (await fsp.readdir(dist)).filter((name) => name !== "SHA256SUMS.txt").sort();
const lines = [];
for (const name of files) {
  const buffer = await fsp.readFile(path.join(dist, name));
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  lines.push(`${hash}  ${name}`);
}
await fsp.writeFile(path.join(dist, "SHA256SUMS.txt"), lines.join("\n") + "\n", "utf8");
console.log(`Biometric bridge package built at ${dist}`);

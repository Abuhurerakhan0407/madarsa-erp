import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(repoRoot, "pnpm-lock.yaml");
const destination = resolve(repoRoot, "public", "__furkania-lock-temp.yaml");

try {
  const info = await stat(source);
  if (!info.isFile()) throw new Error("pnpm-lock.yaml is not a file");
} catch (error) {
  console.error("Expected Vercel install to produce pnpm-lock.yaml before build.");
  throw error;
}

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log("Temporary lockfile audit artifact prepared.");

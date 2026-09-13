import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

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

const encoded = gzipSync(await readFile(source), { level: 9 }).toString("base64");
const chunkSize = 6000;
const chunkCount = Math.ceil(encoded.length / chunkSize);
console.log(`LOCKFILE_EXPORT_BEGIN ${chunkCount}`);
for (let index = 0; index < chunkCount; index += 1) {
  const chunk = encoded.slice(index * chunkSize, (index + 1) * chunkSize);
  console.log(`LOCKFILE_EXPORT_CHUNK ${index + 1}/${chunkCount} ${chunk}`);
}
console.log("LOCKFILE_EXPORT_END");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log("Temporary lockfile audit artifact prepared.");

import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(repoRoot, "pnpm-lock.yaml");
const destination = resolve(repoRoot, "public", "__furkania-lock-temp.yaml");
const chunksDir = resolve(repoRoot, "public", "__furkania-lock-chunks");

try {
  const info = await stat(source);
  if (!info.isFile()) throw new Error("pnpm-lock.yaml is not a file");
} catch (error) {
  console.error("Expected Vercel install to produce pnpm-lock.yaml before build.");
  throw error;
}

const lockfile = await readFile(source);
const encoded = gzipSync(lockfile, { level: 9 }).toString("base64");
const chunkSize = 3000;
const chunkCount = Math.ceil(encoded.length / chunkSize);

await mkdir(chunksDir, { recursive: true });
for (let index = 0; index < chunkCount; index += 1) {
  const part = String(index + 1).padStart(2, "0");
  const chunk = encoded.slice(index * chunkSize, (index + 1) * chunkSize);
  await writeFile(resolve(chunksDir, `part-${part}.b64`), chunk, "utf8");
}

await writeFile(
  resolve(chunksDir, "manifest.json"),
  JSON.stringify({
    chunkSize,
    chunkCount,
    encodedLength: encoded.length,
    lockfileSha256: createHash("sha256").update(lockfile).digest("hex"),
  }),
  "utf8",
);

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log(`Temporary lockfile audit artifacts prepared in ${chunkCount} safe chunks.`);

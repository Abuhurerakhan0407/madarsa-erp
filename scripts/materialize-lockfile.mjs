import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const partsDir = resolve(repoRoot, "lockfile", "pnpm-v9-gzip-base64");
const output = resolve(repoRoot, "pnpm-lock.yaml");

const parts = [];
for (let index = 1; index <= 14; index += 1) {
  const name = `part-${String(index).padStart(2, "0")}.b64`;
  parts.push((await readFile(resolve(partsDir, name), "utf8")).replace(/\s+/g, ""));
}

const compressed = Buffer.from(parts.join(""), "base64");
const lockfile = gunzipSync(compressed);
const text = lockfile.toString("utf8");

if (!text.startsWith("lockfileVersion:") || !text.includes("\nimporters:")) {
  throw new Error("Materialized pnpm lockfile failed structural validation.");
}

await writeFile(output, lockfile);
console.log("Materialized deterministic pnpm-lock.yaml from committed audit payload.");

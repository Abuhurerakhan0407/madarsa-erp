import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const partsDir = resolve(repoRoot, "lockfile", "pnpm-v9-gzip-base64-v2");
const output = resolve(repoRoot, "pnpm-lock.yaml");

const names = (await readdir(partsDir))
  .filter((name) => /^part-\d{2}\.b64$/.test(name))
  .sort();

if (names.length !== 27) {
  throw new Error(`Expected 27 lockfile parts, found ${names.length}.`);
}

const parts = await Promise.all(
  names.map(async (name) =>
    (await readFile(resolve(partsDir, name), "utf8")).replace(/\s+/g, ""),
  ),
);

const encoded = parts.join("");
if (encoded.length !== 78192) {
  throw new Error(`Unexpected lockfile payload length: ${encoded.length}.`);
}

const compressed = Buffer.from(encoded, "base64");
const lockfile = gunzipSync(compressed);
const text = lockfile.toString("utf8");
const sha256 = createHash("sha256").update(lockfile).digest("hex");

if (!text.startsWith("lockfileVersion:") || !text.includes("\nimporters:")) {
  throw new Error("Materialized pnpm lockfile failed structural validation.");
}

if (sha256 !== "ecaaa2ba53b91afd78f8777107a162b1cf05dd3317f999d97da21120a73a41f4") {
  throw new Error(`Materialized pnpm lockfile checksum mismatch: ${sha256}.`);
}

await writeFile(output, lockfile);
console.log("Materialized deterministic pnpm-lock.yaml from committed audit payload.");

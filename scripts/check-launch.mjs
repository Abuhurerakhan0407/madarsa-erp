import { readFile } from "node:fs/promises";

const readiness = JSON.parse(await readFile(new URL("../config/launch-readiness.json", import.meta.url), "utf8"));
const blocking = readiness.gates.filter((gate) => gate.required && !gate.complete);

if (blocking.length > 0) {
  console.error(`Launch blocked by ${blocking.length} gate(s):`);
  for (const gate of blocking) console.error(`- ${gate.key} (${gate.owner})`);
  process.exitCode = 1;
} else {
  console.log("All commercial launch gates passed.");
}

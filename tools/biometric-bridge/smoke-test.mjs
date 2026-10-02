import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import fsp from "node:fs/promises";

const root = process.cwd();
const toolDir = path.join(root, "tools", "biometric-bridge");
const nodeExe = path.join(toolDir, "dist", "node.exe");
const bridge = path.join(toolDir, "dist", "bridge.cjs");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runOnce(configPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(nodeExe, [bridge, "--config", configPath, "--once"], {
      cwd: root,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`bridge exit ${code}; stdout=${stdout}; stderr=${stderr}`));
    });
  });
}

async function queueCount(dataDir) {
  try {
    const names = await fsp.readdir(path.join(dataDir, "queue"));
    return names.filter((name) => name.endsWith(".json")).length;
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }
}

function startServer(port = 0) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      requests.push({
        method: req.method,
        url: req.url,
        token: req.headers["x-device-token"],
        body: JSON.parse(body)
      });
      res.writeHead(202, { "content-type": "application/json" });
      res.end(JSON.stringify({
        event_id: requests.length,
        state: "applied",
        matched: true,
        auto_applied: true,
        retryable: false,
        error: null,
        received_at: new Date().toISOString()
      }));
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve({ server, port: server.address().port, requests });
    });
  });
}

async function stopServer(server) {
  if (!server?.listening) return;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "ilmgaah-biometric-bridge-"));
const exportDir = path.join(tempRoot, "exports");
const dataDir = path.join(tempRoot, "data");
const configPath = path.join(tempRoot, "config.json");
await fsp.mkdir(exportDir, { recursive: true });
await fsp.mkdir(dataDir, { recursive: true });

let active;
try {
  active = await startServer();
  const port = active.port;
  const config = {
    baseUrl: `http://127.0.0.1:${port}`,
    externalDeviceKey: "mbio-package-smoke-01",
    ingestToken: "mdev_package_smoke_123456",
    watchFolder: exportDir,
    fileExtensions: [".csv"],
    pollIntervalSeconds: 2,
    settleSeconds: 1,
    requestTimeoutSeconds: 5,
    maxSendPerCycle: 100,
    retryBaseSeconds: 2,
    retryMaxSeconds: 10,
    dataDir,
    format: {
      subjectColumn: "User ID",
      timestampColumn: "Punch Time",
      dateColumn: null,
      timeColumn: null,
      timezoneOffset: "+05:30",
      dateOrder: "DMY",
      sheetName: null,
      headerRow: 1,
      csvDelimiter: ",",
      eventTypeColumn: "State",
      eventTypeMap: { in: "check_in", out: "check_out" },
      defaultEventType: "presence",
      metadataColumns: ["Verify Mode", "Device Name"]
    }
  };
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2));

  const csv = path.join(exportDir, "attendance.csv");
  await fsp.writeFile(csv,
    "User ID,Punch Time,State,Verify Mode,Device Name\n" +
    "42,20/09/2026 08:15:00,IN,FP,Main Gate\n"
  );
  await sleep(1200);
  await runOnce(configPath);

  assert.equal(active.requests.length, 1);
  assert.equal(active.requests[0].method, "POST");
  assert.equal(active.requests[0].url, "/api/attendance/device-ingest");
  assert.equal(active.requests[0].token, "mdev_package_smoke_123456");
  assert.equal(active.requests[0].body.externalSubjectKey, "42");
  assert.equal(active.requests[0].body.modality, "biometric");
  assert.equal(active.requests[0].body.eventType, "check_in");
  assert.equal(active.requests[0].body.occurredAt, "2026-09-20T02:45:00.000Z");
  assert.equal(await queueCount(dataDir), 0);

  const firstPayload = JSON.stringify(active.requests[0].body).toLowerCase();
  for (const forbidden of ["fingerprint", "biometric_template", "raw_template", "raw_image", "face_image"]) {
    assert.equal(firstPayload.includes(`"${forbidden}"`), false);
  }

  await stopServer(active.server);
  active = null;

  await fsp.writeFile(csv,
    "User ID,Punch Time,State,Verify Mode,Device Name\n" +
    "42,20/09/2026 08:15:00,IN,FP,Main Gate\n" +
    "43,20/09/2026 08:16:00,IN,FP,Main Gate\n"
  );
  await sleep(1200);
  await runOnce(configPath);
  assert.equal(await queueCount(dataDir), 1);

  active = await startServer(port);
  await sleep(2200);
  await runOnce(configPath);

  assert.equal(await queueCount(dataDir), 0);
  assert.equal(active.requests.length, 1);
  assert.equal(active.requests[0].body.externalSubjectKey, "43");

  const health = JSON.parse(await fsp.readFile(path.join(dataDir, "health.json"), "utf8"));
  assert.equal(health.queued, 0);
  assert.equal(health.appliedThisCycle, 1);

  console.log("Biometric bridge package smoke passed: delivery + offline queue + retry.");
} finally {
  await stopServer(active?.server).catch(() => {});
  await fsp.rm(tempRoot, { recursive: true, force: true });
}

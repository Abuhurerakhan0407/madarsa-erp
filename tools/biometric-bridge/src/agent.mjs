import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  BRIDGE_VERSION,
  normalizeExportRows,
  retryDelayMs,
  validateConfig
} from "./core.mjs";
import { readExportRows } from "./reader.mjs";

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
const once = process.argv.includes("--once");
const validateOnly = process.argv.includes("--validate");
const configPath = path.resolve(argValue("--config") ?? process.env.ILMGAAH_BRIDGE_CONFIG ?? "config.json");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isoNow = () => new Date().toISOString();

async function readJson(file, fallback = null) {
  try { return JSON.parse(await fsp.readFile(file, "utf8")); }
  catch (error) {
    if (error && error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function atomicJson(file, value) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await fsp.writeFile(temp, JSON.stringify(value, null, 2) + "\n", "utf8");
  await fsp.rename(temp, file);
}

function safeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/mdev_[A-Za-z0-9_-]+/g, "mdev_[REDACTED]").slice(0, 1000);
}

async function rotateLog(file) {
  try {
    const stat = await fsp.stat(file);
    if (stat.size < 10 * 1024 * 1024) return;
    await fsp.rename(file, `${file}.1`).catch(async () => {
      await fsp.rm(`${file}.1`, { force: true });
      await fsp.rename(file, `${file}.1`);
    });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function createLogger(file) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await rotateLog(file);
  return async (level, message, details = {}) => {
    const safeDetails = { ...details };
    delete safeDetails.ingestToken;
    await fsp.appendFile(file, JSON.stringify({ at: isoNow(), level, message, ...safeDetails }) + "\n", "utf8");
  };
}

async function loadSeen(file) {
  try {
    const content = await fsp.readFile(file, "utf8");
    return new Set(content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function acquireLock(lockPath) {
  await fsp.mkdir(path.dirname(lockPath), { recursive: true });
  try {
    const handle = await fsp.open(lockPath, "wx");
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: isoNow() }));
    await handle.close();
    return;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const old = await readJson(lockPath, {});
  if (Number.isInteger(old?.pid)) {
    try {
      process.kill(old.pid, 0);
      throw new Error(`Another Ilmgaah Biometric Bridge is already running (PID ${old.pid}).`);
    } catch (error) {
      if (error?.code !== "ESRCH" && !String(error?.message ?? "").includes("already running")) throw error;
      if (String(error?.message ?? "").includes("already running")) throw error;
    }
  }
  await fsp.rm(lockPath, { force: true });
  const handle = await fsp.open(lockPath, "wx");
  await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: isoNow() }));
  await handle.close();
}

function queueFile(queueDir, eventId) {
  return path.join(queueDir, `${eventId}.json`);
}

async function enqueue(item, queueDir, seen) {
  const id = item.event.externalEventId;
  if (seen.has(id)) return false;
  const file = queueFile(queueDir, id);
  try { await fsp.access(file); return false; } catch {}
  await atomicJson(file, item);
  return true;
}

async function queueCount(queueDir) {
  try { return (await fsp.readdir(queueDir)).filter((name) => name.endsWith(".json")).length; }
  catch (error) { if (error.code === "ENOENT") return 0; throw error; }
}

async function scanExports(context) {
  const { config, dataDir, queueDir, seen, log } = context;
  const statePath = path.join(dataDir, "files.json");
  const state = await readJson(statePath, {});
  const names = await fsp.readdir(config.watchFolder);
  let discovered = 0;
  let rowErrors = 0;
  for (const name of names.sort()) {
    const file = path.join(config.watchFolder, name);
    const ext = path.extname(name).toLowerCase();
    if (!config.fileExtensions.includes(ext)) continue;
    const statBefore = await fsp.stat(file);
    if (!statBefore.isFile()) continue;
    if (Date.now() - statBefore.mtimeMs < config.settleSeconds * 1000) continue;
    const signature = `${statBefore.size}:${Math.trunc(statBefore.mtimeMs)}`;
    if (state[file] === signature) continue;

    try {
      const rows = await readExportRows(file, config);
      const normalized = normalizeExportRows(rows, config, file);
      for (const event of normalized.events) {
        const added = await enqueue({
          version: 1,
          event,
          attempts: 0,
          nextAttemptAt: null,
          createdAt: isoNow(),
          sourceFile: path.basename(file)
        }, queueDir, seen);
        if (added) discovered++;
      }
      rowErrors += normalized.errors.length;
      if (normalized.errors.length) {
        await log("warn", "Export contained invalid rows.", {
          sourceFile: path.basename(file),
          invalidRows: normalized.errors.slice(0, 20)
        });
      }
      const statAfter = await fsp.stat(file);
      if (statAfter.size === statBefore.size && Math.trunc(statAfter.mtimeMs) === Math.trunc(statBefore.mtimeMs)) {
        state[file] = signature;
      }
    } catch (error) {
      await log("error", "Unable to parse biometric export.", { sourceFile: path.basename(file), error: safeError(error) });
    }
  }
  await atomicJson(statePath, state);
  return { discovered, rowErrors };
}

async function scheduleRetry(file, item, config, errorMessage = null) {
  item.attempts = Number(item.attempts ?? 0) + 1;
  item.lastAttemptAt = isoNow();
  item.lastError = errorMessage?.slice(0, 1000) ?? null;
  item.nextAttemptAt = new Date(Date.now() + retryDelayMs(item.attempts, config)).toISOString();
  await atomicJson(file, item);
}

async function quarantine(file, item, quarantineDir, reason) {
  item.quarantinedAt = isoNow();
  item.lastError = reason.slice(0, 1000);
  const target = path.join(quarantineDir, path.basename(file));
  await atomicJson(target, item);
  await fsp.rm(file, { force: true });
}

async function sendQueue(context) {
  const { config, queueDir, quarantineDir, seenFile, seen, log } = context;
  let names = [];
  try { names = (await fsp.readdir(queueDir)).filter((name) => name.endsWith(".json")).sort(); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  let applied = 0, deferred = 0, failed = 0;
  for (const name of names.slice(0, config.maxSendPerCycle)) {
    const file = path.join(queueDir, name);
    const item = await readJson(file);
    if (!item?.event?.externalEventId) { await fsp.rm(file, { force: true }); continue; }
    if (seen.has(item.event.externalEventId)) { await fsp.rm(file, { force: true }); continue; }
    if (item.nextAttemptAt && Date.parse(item.nextAttemptAt) > Date.now()) { deferred++; continue; }

    try {
      const response = await fetch(`${config.baseUrl}/api/attendance/device-ingest`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-device-token": config.ingestToken,
          "user-agent": `Ilmgaah-Biometric-Bridge/${BRIDGE_VERSION}`
        },
        body: JSON.stringify(item.event),
        signal: AbortSignal.timeout(config.requestTimeoutSeconds * 1000)
      });
      let body = {};
      try { body = await response.json(); } catch {}

      if (response.status === 202 && (body.auto_applied === true || body.state === "applied")) {
        await fsp.appendFile(seenFile, item.event.externalEventId + "\n", "utf8");
        seen.add(item.event.externalEventId);
        await fsp.rm(file, { force: true });
        applied++;
        await log("info", "Biometric event applied.", {
          externalEventId: item.event.externalEventId,
          externalSubjectKey: item.event.externalSubjectKey,
          occurredAt: item.event.occurredAt
        });
        continue;
      }

      if (response.status === 400) {
        const reason = typeof body.error === "string" ? body.error : "Ilmgaah rejected the device event.";
        await quarantine(file, item, quarantineDir, reason);
        failed++;
        await log("error", "Biometric event quarantined.", { externalEventId: item.event.externalEventId, error: reason });
        continue;
      }

      const reason = typeof body.error === "string"
        ? body.error
        : `Ilmgaah returned HTTP ${response.status} with state ${String(body.state ?? "unknown")}.`;
      await scheduleRetry(file, item, config, reason);
      deferred++;
      if (response.status === 401) await log("error", "Device token was rejected; event remains queued.", { error: reason });
      else if (response.status !== 202) await log("warn", "Biometric event send will retry.", { status: response.status, error: reason });
    } catch (error) {
      await scheduleRetry(file, item, config, safeError(error));
      deferred++;
      await log("warn", "Network delivery failed; event remains queued.", { error: safeError(error) });
    }
  }
  return { applied, deferred, failed };
}

async function writeHealth(context, status, details = {}) {
  const queued = await queueCount(context.queueDir);
  await atomicJson(path.join(context.dataDir, "health.json"), {
    version: BRIDGE_VERSION,
    status,
    pid: process.pid,
    updatedAt: isoNow(),
    queued,
    ...details
  });
}

async function main() {
  const raw = JSON.parse(await fsp.readFile(configPath, "utf8"));
  const config = validateConfig(raw);
  await fsp.access(config.watchFolder);
  const dataDir = path.resolve(config.dataDir ?? path.join(path.dirname(configPath), "data"));
  const queueDir = path.join(dataDir, "queue");
  const quarantineDir = path.join(dataDir, "quarantine");
  const logsDir = path.join(dataDir, "logs");
  await Promise.all([queueDir, quarantineDir, logsDir].map((dir) => fsp.mkdir(dir, { recursive: true })));
  const log = await createLogger(path.join(logsDir, "bridge.jsonl"));
  const seenFile = path.join(dataDir, "seen.log");
  const seen = await loadSeen(seenFile);
  const lockPath = path.join(dataDir, "bridge.lock");

  if (validateOnly) {
    console.log(JSON.stringify({
      valid: true,
      version: BRIDGE_VERSION,
      baseUrl: config.baseUrl,
      externalDeviceKey: config.externalDeviceKey,
      watchFolder: config.watchFolder,
      fileExtensions: config.fileExtensions
    }, null, 2));
    return;
  }

  await acquireLock(lockPath);
  let stopping = false;
  const stop = () => { stopping = true; };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  const context = { config, dataDir, queueDir, quarantineDir, log, seenFile, seen };
  await log("info", "Ilmgaah Biometric Bridge started.", {
    version: BRIDGE_VERSION,
    externalDeviceKey: config.externalDeviceKey,
    watchFolder: config.watchFolder
  });

  try {
    while (!stopping) {
      const cycleStartedAt = isoNow();
      try {
        const scan = await scanExports(context);
        const delivery = await sendQueue(context);
        await writeHealth(context, delivery.failed ? "degraded" : "running", {
          cycleStartedAt,
          lastScanAt: isoNow(),
          discovered: scan.discovered,
          invalidRows: scan.rowErrors,
          appliedThisCycle: delivery.applied,
          deferredThisCycle: delivery.deferred
        });
      } catch (error) {
        const message = safeError(error);
        await log("error", "Bridge cycle failed.", { error: message });
        await writeHealth(context, "degraded", { cycleStartedAt, lastError: message });
      }
      if (once) break;
      await sleep(config.pollIntervalSeconds * 1000);
    }
  } finally {
    await fsp.rm(lockPath, { force: true });
    await log("info", "Ilmgaah Biometric Bridge stopped.");
  }
}

main().catch((error) => {
  console.error(`Ilmgaah Biometric Bridge failed: ${safeError(error)}`);
  process.exitCode = 1;
});

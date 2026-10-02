import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import {
  makeExternalEventId,
  normalizeExportRows,
  parseCsv,
  retryDelayMs,
  toIsoTimestamp,
  validateConfig
} from "../../../tools/biometric-bridge/src/core.mjs";
import { readExportRows } from "../../../tools/biometric-bridge/src/reader.mjs";

const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

function config(overrides: Record<string, unknown> = {}) {
  const formatOverrides = overrides.format && typeof overrides.format === "object"
    ? overrides.format as Record<string, unknown>
    : {};
  return validateConfig({
    baseUrl: "https://staging.ilmgaah.in",
    externalDeviceKey: "mbio-main-01",
    ingestToken: "mdev_1234567890abcdef",
    watchFolder: "C:\\MBio\\Exports",
    pollIntervalSeconds: 5,
    ...overrides,
    format: {
      subjectColumn: "User ID",
      timestampColumn: "Punch Time",
      timezoneOffset: "+05:30",
      dateOrder: "DMY",
      eventTypeColumn: "State",
      eventTypeMap: { in: "check_in", out: "check_out" },
      defaultEventType: "presence",
      metadataColumns: ["Verify Mode"],
      ...formatOverrides
    }
  });
}

describe("Ilmgaah Windows biometric bridge", () => {
  it("rejects insecure remote endpoints and biometric metadata columns", () => {
    expect(() => config({ baseUrl: "http://example.com" })).toThrow(/https/i);
    expect(() => config({ format: { metadataColumns: ["Fingerprint Template"] } })).toThrow(/sensitive biometric column/i);
  });

  it("parses CSV with a configurable header row and quoted fields", () => {
    const rows = parseCsv(
      'Report,Generated\nUser ID,Punch Time,State,Note\n"42","20/09/2026 08:15:00","IN","Gate, A"\n',
      ",",
      2
    );
    expect(rows).toEqual([
      { "User ID": "42", "Punch Time": "20/09/2026 08:15:00", State: "IN", Note: "Gate, A" }
    ]);
  });

  it("converts Indian DMY timestamps using the configured source offset", () => {
    const c = config();
    expect(toIsoTimestamp("20/09/2026 08:15:00", c.format)).toBe("2026-09-20T02:45:00.000Z");
    expect(toIsoTimestamp("20/09/2026", c.format, "8:15 AM")).toBe("2026-09-20T02:45:00.000Z");
  });

  it("normalizes exports into deterministic biometric-only events", () => {
    const c = config();
    const rows = [
      { "User ID": "42", "Punch Time": "20/09/2026 08:15:00", State: "IN", "Verify Mode": "FP" }
    ];
    const first = normalizeExportRows(rows, c, "attendance.csv");
    const second = normalizeExportRows(rows, c, "attendance.csv");
    expect(first.errors).toEqual([]);
    expect(first.events).toHaveLength(1);
    expect(first.events[0]).toMatchObject({
      externalDeviceKey: "mbio-main-01",
      externalSubjectKey: "42",
      modality: "biometric",
      eventType: "check_in",
      occurredAt: "2026-09-20T02:45:00.000Z"
    });
    expect(first.events[0].externalEventId).toBe(second.events[0].externalEventId);
    expect(first.events[0].metadata).toMatchObject({ vendor_verify_mode: "FP" });
    expect(
      makeExternalEventId("mbio-main-01", "42", "2026-09-20T02:45:00.000Z", "check_in")
    ).toBe(first.events[0].externalEventId);
  });

  it("reads XLSX exports using the configured sheet/header contract", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ilmgaah-bridge-"));
    tempDirs.push(dir);
    const file = path.join(dir, "export.xlsx");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Attendance");
    sheet.addRow(["User ID", "Punch Time", "State"]);
    sheet.addRow(["7", "20/09/2026 09:05:00", "OUT"]);
    await workbook.xlsx.writeFile(file);

    const c = config({ watchFolder: dir, format: { sheetName: "Attendance" } });
    const rows = await readExportRows(file, c);
    expect(rows).toEqual([
      { "User ID": "7", "Punch Time": "20/09/2026 09:05:00", State: "OUT" }
    ]);
    expect(normalizeExportRows(rows, c, file).events[0].eventType).toBe("check_out");
  });

  it("backs off retries with a configured ceiling", () => {
    const c = config({ retryBaseSeconds: 10, retryMaxSeconds: 60 });
    expect(retryDelayMs(1, c)).toBe(10000);
    expect(retryDelayMs(3, c)).toBe(40000);
    expect(retryDelayMs(8, c)).toBe(60000);
  });
});

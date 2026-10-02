import { createHash } from "node:crypto";
import path from "node:path";

export const BRIDGE_VERSION = "1.0.0";
export const ALLOWED_EVENT_TYPES = new Set(["presence", "check_in", "check_out"]);
export const FORBIDDEN_BIOMETRIC_COLUMN = /(fingerprint|finger|face|template|image|photo|biometric)/i;

function requiredText(value, name) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${name} is required.`);
  return text;
}

function integer(value, fallback, min, max, name) {
  const n = value === undefined || value === null ? fallback : Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be between ${min} and ${max}.`);
  return n;
}

function normalizeExtension(value) {
  const ext = String(value ?? "").trim().toLowerCase();
  if (!ext) return "";
  return ext.startsWith(".") ? ext : `.${ext}`;
}

function safeMetadataKey(value) {
  const key = String(value ?? "").trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return key ? `vendor_${key}` : "";
}

export function validateConfig(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Bridge config must be an object.");
  const baseUrl = requiredText(input.baseUrl, "baseUrl").replace(/\/+$/, "");
  const parsed = new URL(baseUrl);
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(localHost && parsed.protocol === "http:")) {
    throw new Error("baseUrl must use HTTPS (HTTP is allowed only for localhost testing).");
  }

  const externalDeviceKey = requiredText(input.externalDeviceKey, "externalDeviceKey").toLowerCase();
  if (externalDeviceKey.length < 3 || externalDeviceKey.length > 120) throw new Error("externalDeviceKey must be 3-120 characters.");

  const ingestToken = requiredText(input.ingestToken, "ingestToken");
  if (!ingestToken.startsWith("mdev_") || ingestToken.length > 128) throw new Error("ingestToken is not a valid Ilmgaah device token.");

  const watchFolder = requiredText(input.watchFolder, "watchFolder");
  const fileExtensions = (Array.isArray(input.fileExtensions) && input.fileExtensions.length ? input.fileExtensions : [".csv", ".xlsx"])
    .map(normalizeExtension)
    .filter(Boolean);
  for (const ext of fileExtensions) if (![".csv", ".xlsx"].includes(ext)) throw new Error(`Unsupported export extension: ${ext}. Use CSV or XLSX.`);

  const formatInput = input.format && typeof input.format === "object" && !Array.isArray(input.format) ? input.format : {};
  const subjectColumn = requiredText(formatInput.subjectColumn, "format.subjectColumn");
  const timestampColumn = typeof formatInput.timestampColumn === "string" && formatInput.timestampColumn.trim() ? formatInput.timestampColumn.trim() : null;
  const dateColumn = typeof formatInput.dateColumn === "string" && formatInput.dateColumn.trim() ? formatInput.dateColumn.trim() : null;
  const timeColumn = typeof formatInput.timeColumn === "string" && formatInput.timeColumn.trim() ? formatInput.timeColumn.trim() : null;
  if (!timestampColumn && !(dateColumn && timeColumn)) {
    throw new Error("Configure format.timestampColumn or both format.dateColumn and format.timeColumn.");
  }

  const timezoneOffset = requiredText(formatInput.timezoneOffset, "format.timezoneOffset");
  if (!/^[+-](?:0\d|1\d|2[0-3]):[0-5]\d$/.test(timezoneOffset)) throw new Error("format.timezoneOffset must look like +05:30.");

  const dateOrder = String(formatInput.dateOrder ?? "DMY").toUpperCase();
  if (!["DMY", "MDY", "YMD"].includes(dateOrder)) throw new Error("format.dateOrder must be DMY, MDY, or YMD.");

  const defaultEventType = String(formatInput.defaultEventType ?? "presence").trim().toLowerCase();
  if (!ALLOWED_EVENT_TYPES.has(defaultEventType)) throw new Error("format.defaultEventType is invalid.");

  const eventTypeColumn = typeof formatInput.eventTypeColumn === "string" && formatInput.eventTypeColumn.trim() ? formatInput.eventTypeColumn.trim() : null;
  const eventTypeMap = {};
  if (formatInput.eventTypeMap !== undefined) {
    if (!formatInput.eventTypeMap || typeof formatInput.eventTypeMap !== "object" || Array.isArray(formatInput.eventTypeMap)) throw new Error("format.eventTypeMap must be an object.");
    for (const [key, value] of Object.entries(formatInput.eventTypeMap)) {
      const mapped = String(value).trim().toLowerCase();
      if (!ALLOWED_EVENT_TYPES.has(mapped)) throw new Error(`Invalid event type mapping for "${key}".`);
      eventTypeMap[String(key).trim().toLowerCase()] = mapped;
    }
  }

  const metadataColumns = Array.isArray(formatInput.metadataColumns)
    ? formatInput.metadataColumns.map((value) => requiredText(value, "format.metadataColumns entry"))
    : [];
  for (const column of metadataColumns) {
    if (FORBIDDEN_BIOMETRIC_COLUMN.test(column)) throw new Error(`Sensitive biometric column cannot be exported as metadata: ${column}.`);
  }

  return {
    baseUrl,
    externalDeviceKey,
    ingestToken,
    watchFolder,
    fileExtensions: [...new Set(fileExtensions)],
    pollIntervalSeconds: integer(input.pollIntervalSeconds, 5, 2, 300, "pollIntervalSeconds"),
    settleSeconds: integer(input.settleSeconds, 3, 1, 120, "settleSeconds"),
    requestTimeoutSeconds: integer(input.requestTimeoutSeconds, 20, 5, 120, "requestTimeoutSeconds"),
    maxSendPerCycle: integer(input.maxSendPerCycle, 100, 1, 1000, "maxSendPerCycle"),
    retryBaseSeconds: integer(input.retryBaseSeconds, 10, 2, 600, "retryBaseSeconds"),
    retryMaxSeconds: integer(input.retryMaxSeconds, 300, 10, 86400, "retryMaxSeconds"),
    dataDir: typeof input.dataDir === "string" && input.dataDir.trim() ? input.dataDir.trim() : null,
    format: {
      subjectColumn,
      timestampColumn,
      dateColumn,
      timeColumn,
      timezoneOffset,
      dateOrder,
      sheetName: typeof formatInput.sheetName === "string" && formatInput.sheetName.trim() ? formatInput.sheetName.trim() : null,
      headerRow: integer(formatInput.headerRow, 1, 1, 100, "format.headerRow"),
      csvDelimiter: typeof formatInput.csvDelimiter === "string" && formatInput.csvDelimiter.length === 1 ? formatInput.csvDelimiter : ",",
      eventTypeColumn,
      eventTypeMap,
      defaultEventType,
      metadataColumns
    }
  };
}

export function parseCsv(text, delimiter = ",", headerRow = 1) {
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  if (delimiter.length !== 1) throw new Error("CSV delimiter must be one character.");
  if (!Number.isInteger(headerRow) || headerRow < 1) throw new Error("CSV headerRow must be a positive integer.");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === delimiter) { row.push(field); field = ""; continue; }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
  }
  if (rows.length < headerRow) return [];
  const headers = rows[headerRow - 1].map((value) => String(value).trim());
  if (headers.some((header) => !header)) throw new Error("CSV header contains an empty column.");
  if (new Set(headers).size !== headers.length) throw new Error("CSV header contains duplicate columns.");
  return rows.slice(headerRow).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function offsetMinutes(offset) {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!match) throw new Error("Invalid timezone offset.");
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "+" ? minutes : -minutes;
}

function excelSerialToDate(value) {
  return new Date(Date.UTC(1899, 11, 30) + Number(value) * 86400000);
}

function partsToIso({ year, month, day, hour, minute, second }, timezoneOffset) {
  const utc = Date.UTC(year, month - 1, day, hour, minute, second) - offsetMinutes(timezoneOffset) * 60000;
  const date = new Date(utc);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 2000 || date.getUTCFullYear() > 2100) throw new Error("Timestamp is outside the supported date range.");
  return date.toISOString();
}

function parseClock(value) {
  const text = String(value ?? "").trim();
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(text);
  if (!m) throw new Error(`Unsupported time value: ${text}`);
  let hour = Number(m[1]);
  const minute = Number(m[2]), second = Number(m[3] ?? 0);
  if (minute > 59 || second > 59) throw new Error(`Invalid time value: ${text}`);
  const meridiem = m[4]?.toLowerCase();
  if (meridiem) {
    if (hour < 1 || hour > 12) throw new Error(`Invalid 12-hour time: ${text}`);
    if (meridiem === "am") hour = hour === 12 ? 0 : hour;
    else hour = hour === 12 ? 12 : hour + 12;
  } else if (hour > 23) throw new Error(`Invalid 24-hour time: ${text}`);
  return { hour, minute, second };
}

function parseDate(value, dateOrder) {
  const text = String(value ?? "").trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (m) return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (!m) throw new Error(`Unsupported date value: ${text}`);
  const a=Number(m[1]), b=Number(m[2]), year=Number(m[3]);
  if (dateOrder === "MDY") return { year, month:a, day:b };
  return { year, month:b, day:a };
}

export function toIsoTimestamp(value, format, separateTime = null) {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error("Invalid Date value.");
    return value.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) return excelSerialToDate(value).toISOString();

  if (separateTime !== null) {
    const date = parseDate(value, format.dateOrder);
    return partsToIso({ ...date, ...parseClock(separateTime) }, format.timezoneOffset);
  }

  const text = String(value ?? "").trim();
  if (!text) throw new Error("Attendance timestamp is empty.");
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text)) {
    const ms = Date.parse(text);
    if (!Number.isFinite(ms)) throw new Error(`Invalid timestamp: ${text}`);
    return new Date(ms).toISOString();
  }

  const isoLike = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(text);
  if (isoLike) {
    const clock = parseClock(`${isoLike[4]}:${isoLike[5]}:${isoLike[6] ?? "00"}${isoLike[7] ? " "+isoLike[7] : ""}`);
    return partsToIso({ year:Number(isoLike[1]), month:Number(isoLike[2]), day:Number(isoLike[3]), ...clock }, format.timezoneOffset);
  }

  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})[ T](.+)$/.exec(text);
  if (dmy) {
    const date = parseDate(`${dmy[1]}/${dmy[2]}/${dmy[3]}`, format.dateOrder);
    return partsToIso({ ...date, ...parseClock(dmy[4]) }, format.timezoneOffset);
  }
  throw new Error(`Unsupported timestamp: ${text}`);
}

export function makeExternalEventId(externalDeviceKey, externalSubjectKey, occurredAt, eventType) {
  const digest = createHash("sha256")
    .update([externalDeviceKey, externalSubjectKey, occurredAt, eventType].join("|"))
    .digest("hex")
    .slice(0, 48);
  return `bridge_${digest}`;
}

function cellText(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) return cellText(value.result);
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text ?? "").join("");
    if ("text" in value) return String(value.text ?? "");
  }
  return value;
}

export function normalizeExportRows(rows, config, sourceFile) {
  const events = [];
  const errors = [];
  const f = config.format;
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index] ?? {};
    const rowNumber = f.headerRow + index + 1;
    try {
      const subject = String(cellText(row[f.subjectColumn]) ?? "").trim();
      if (!subject || subject.length > 120) throw new Error("Device user ID is missing or too long.");

      const occurredAt = f.timestampColumn
        ? toIsoTimestamp(cellText(row[f.timestampColumn]), f)
        : toIsoTimestamp(cellText(row[f.dateColumn]), f, cellText(row[f.timeColumn]));

      let eventType = f.defaultEventType;
      if (f.eventTypeColumn) {
        const raw = String(cellText(row[f.eventTypeColumn]) ?? "").trim().toLowerCase();
        if (raw) eventType = f.eventTypeMap[raw] ?? eventType;
      }
      if (!ALLOWED_EVENT_TYPES.has(eventType)) throw new Error("Punch type could not be mapped.");

      const metadata = {
        source_file: path.basename(sourceFile).slice(0, 256),
        source_row: rowNumber,
        bridge_version: BRIDGE_VERSION
      };
      for (const column of f.metadataColumns) {
        if (FORBIDDEN_BIOMETRIC_COLUMN.test(column)) continue;
        const key = safeMetadataKey(column);
        if (!key) continue;
        const raw = cellText(row[column]);
        if (raw instanceof Date) metadata[key] = raw.toISOString();
        else if (typeof raw === "number" || typeof raw === "boolean") metadata[key] = raw;
        else metadata[key] = String(raw ?? "").slice(0, 256);
      }

      const externalEventId = makeExternalEventId(config.externalDeviceKey, subject, occurredAt, eventType);
      events.push({
        externalDeviceKey: config.externalDeviceKey,
        externalEventId,
        externalSubjectKey: subject,
        modality: "biometric",
        eventType,
        occurredAt,
        metadata
      });
    } catch (error) {
      errors.push({ row: rowNumber, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { events, errors };
}

export function retryDelayMs(attempts, config) {
  const seconds = Math.min(config.retryMaxSeconds, config.retryBaseSeconds * 2 ** Math.max(0, attempts - 1));
  return seconds * 1000;
}

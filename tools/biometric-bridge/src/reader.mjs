import fsp from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { parseCsv } from "./core.mjs";

export function cellPrimitive(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value;
  if (typeof value !== "object") return value;
  if (value.result !== undefined) return cellPrimitive(value.result);
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text ?? "").join("");
  if (value.text !== undefined) return String(value.text ?? "");
  return String(value);
}

export async function readExportRows(file, config) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".csv") {
    const text = await fsp.readFile(file, "utf8");
    return parseCsv(text, config.format.csvDelimiter, config.format.headerRow);
  }
  if (ext !== ".xlsx") throw new Error(`Unsupported file extension: ${ext}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = config.format.sheetName ? workbook.getWorksheet(config.format.sheetName) : workbook.worksheets[0];
  if (!sheet) throw new Error("Configured Excel worksheet was not found.");

  const headerRow = sheet.getRow(config.format.headerRow);
  const columns = [];
  const seen = new Set();
  for (let col = 1; col <= sheet.columnCount; col++) {
    const header = String(cellPrimitive(headerRow.getCell(col).value) ?? "").trim();
    if (!header) continue;
    if (seen.has(header)) throw new Error(`Excel header contains duplicate column: ${header}`);
    seen.add(header);
    columns.push({ col, header });
  }
  if (!columns.length) throw new Error("Excel export has no usable header columns.");

  const rows = [];
  for (let rowNumber = config.format.headerRow + 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const worksheetRow = sheet.getRow(rowNumber);
    const record = {};
    let nonEmpty = false;
    for (const { col, header } of columns) {
      const value = cellPrimitive(worksheetRow.getCell(col).value);
      record[header] = value;
      if (value instanceof Date || String(value ?? "").trim() !== "") nonEmpty = true;
    }
    if (nonEmpty) rows.push(record);
  }
  return rows;
}

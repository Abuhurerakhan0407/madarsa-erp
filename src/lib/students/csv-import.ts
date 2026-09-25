export const STUDENT_IMPORT_TEMPLATE_CSV = [
  "display_name,name_native,date_of_birth,gender,preferred_locale,guardian_name,guardian_relationship,guardian_phone,guardian_email",
  "Ahmed Khan,,2014-01-15,male,en,Parent Name,father,9000000000,parent@example.com"
].join("\r\n");

export type StudentImportRow = {
  display_name: string;
  name_native?: string;
  date_of_birth?: string;
  gender?: "male" | "female" | "other" | "undisclosed";
  preferred_locale?: "en" | "ur";
  guardian?: {
    name: string;
    relationship: "father" | "mother" | "guardian";
    phone?: string;
    email?: string;
  };
};

export type StudentImportIssue = {
  rowNumber: number;
  severity: "error" | "warning";
  code: string;
  message: string;
};

export type StudentImportPreviewRow = {
  rowNumber: number;
  row: StudentImportRow | null;
  issues: StudentImportIssue[];
};

export type StudentImportAnalysis = {
  rows: StudentImportPreviewRow[];
  validRows: StudentImportRow[];
  issues: StudentImportIssue[];
  headerWarnings: string[];
};

const aliases: Record<string, string> = {
  display_name: "display_name", student_name: "display_name", name: "display_name",
  name_native: "name_native", native_name: "name_native",
  date_of_birth: "date_of_birth", dob: "date_of_birth",
  gender: "gender", preferred_locale: "preferred_locale", locale: "preferred_locale",
  guardian_name: "guardian_name", parent_name: "guardian_name",
  guardian_relationship: "guardian_relationship", relationship: "guardian_relationship",
  guardian_phone: "guardian_phone", parent_phone: "guardian_phone", phone: "guardian_phone",
  guardian_email: "guardian_email", parent_email: "guardian_email"
};

const knownHeaders = new Set(Object.values(aliases));

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizedName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function parseMatrix(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"';
        i += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      continue;
    }
    field += char;
  }

  row.push(field);
  if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  return rows;
}

function issue(rowNumber: number, severity: "error" | "warning", code: string, message: string): StudentImportIssue {
  return { rowNumber, severity, code, message };
}

function buildRow(record: Record<string, string>, rowNumber: number): StudentImportPreviewRow {
  const issues: StudentImportIssue[] = [];
  const displayName = record.display_name ?? "";
  if (!displayName) issues.push(issue(rowNumber, "error", "student_name_required", "Student name is required."));
  if (displayName.length > 160) issues.push(issue(rowNumber, "error", "student_name_too_long", "Student name is too long."));

  const gender = record.gender?.toLowerCase() ?? "";
  if (gender && !["male", "female", "other", "undisclosed"].includes(gender)) {
    issues.push(issue(rowNumber, "error", "invalid_gender", "Gender must be male, female, other, or undisclosed."));
  }
  const locale = record.preferred_locale?.toLowerCase() ?? "";
  if (locale && !["en", "ur"].includes(locale)) {
    issues.push(issue(rowNumber, "error", "invalid_locale", "Preferred locale must be en or ur."));
  }

  const dateOfBirth = record.date_of_birth ?? "";
  if (dateOfBirth && !validDate(dateOfBirth)) {
    issues.push(issue(rowNumber, "error", "invalid_date_of_birth", "Date of birth must be a real date in YYYY-MM-DD format."));
  }

  const guardianName = record.guardian_name ?? "";
  const relationship = (record.guardian_relationship || "guardian").toLowerCase();
  const guardianPhone = record.guardian_phone ?? "";
  const guardianEmail = (record.guardian_email ?? "").toLowerCase();

  if ((guardianPhone || guardianEmail || record.guardian_relationship) && !guardianName) {
    issues.push(issue(rowNumber, "error", "guardian_name_required", "Guardian name is required when guardian details are provided."));
  }
  if (guardianName && !["father", "mother", "guardian"].includes(relationship)) {
    issues.push(issue(rowNumber, "error", "invalid_guardian_relationship", "Guardian relationship must be father, mother, or guardian."));
  }
  if (guardianPhone.length > 40) {
    issues.push(issue(rowNumber, "error", "guardian_phone_too_long", "Guardian phone is too long."));
  }
  if (guardianEmail && !validEmail(guardianEmail)) {
    issues.push(issue(rowNumber, "error", "invalid_guardian_email", "Guardian email is invalid."));
  }
  if (guardianName && !guardianPhone && !guardianEmail) {
    issues.push(issue(rowNumber, "warning", "guardian_no_matching_contact", "Guardian has no phone or email, so sibling matching cannot be verified."));
  }

  const hasError = issues.some((item) => item.severity === "error");
  if (hasError) return { rowNumber, row: null, issues };

  const row: StudentImportRow = {
    display_name: displayName,
    ...(record.name_native ? { name_native: record.name_native } : {}),
    ...(dateOfBirth ? { date_of_birth: dateOfBirth } : {}),
    ...(gender ? { gender: gender as StudentImportRow["gender"] } : {}),
    ...(locale ? { preferred_locale: locale as StudentImportRow["preferred_locale"] } : {}),
    ...(guardianName ? {
      guardian: {
        name: guardianName,
        relationship: relationship as "father" | "mother" | "guardian",
        ...(guardianPhone ? { phone: guardianPhone } : {}),
        ...(guardianEmail ? { email: guardianEmail } : {})
      }
    } : {})
  };
  return { rowNumber, row, issues };
}

export function analyzeStudentImportCsv(input: string): StudentImportAnalysis {
  if (typeof input !== "string" || !input.trim()) throw new Error("CSV file is empty.");
  if (input.length > 262144) throw new Error("CSV file is too large. Use batches of up to 100 students.");
  const matrix = parseMatrix(input.replace(/^\uFEFF/, ""));
  if (matrix.length < 2) throw new Error("CSV must include a header row and at least one student.");

  const normalized = matrix[0].map(normalizeHeader);
  const headers = normalized.map((value) => aliases[value] ?? value);
  if (!headers.includes("display_name")) {
    throw new Error("CSV requires a display_name, student_name, or name column.");
  }
  const duplicateHeaders = headers.filter((value, index) => headers.indexOf(value) !== index);
  if (duplicateHeaders.length) throw new Error(`CSV contains duplicate columns: ${[...new Set(duplicateHeaders)].join(", ")}.`);
  const headerWarnings = normalized
    .filter((value, index) => value && !knownHeaders.has(headers[index]))
    .map((value) => `Unknown column "${value}" will be ignored.`);

  const rows: StudentImportPreviewRow[] = [];
  for (const [index, values] of matrix.slice(1).entries()) {
    if (rows.length >= 100) throw new Error("CSV import supports at most 100 students per batch.");
    const record: Record<string, string> = {};
    headers.forEach((key, column) => {
      if (knownHeaders.has(key)) record[key] = (values[column] ?? "").trim();
    });
    rows.push(buildRow(record, index + 2));
  }

  const duplicateBuckets = new Map<string, StudentImportPreviewRow[]>();
  for (const preview of rows) {
    if (!preview.row) continue;

    const key = `${normalizedName(preview.row.display_name)}|${preview.row.date_of_birth ?? "*"}`;
    const bucket = duplicateBuckets.get(key) ?? [];
    bucket.push(preview);
    duplicateBuckets.set(key, bucket);
  }

  for (const bucket of duplicateBuckets.values()) {
    if (bucket.length < 2) continue;
    for (const preview of bucket) {
      preview.issues.push(issue(
        preview.rowNumber,
        "error",
        "duplicate_in_file",
        "Possible duplicate student appears more than once in this CSV."
      ));
    }
  }

  const issues = rows.flatMap((preview) => preview.issues);
  const validRows = rows
    .filter((preview) => preview.row && !preview.issues.some((item) => item.severity === "error"))
    .map((preview) => preview.row as StudentImportRow);

  return { rows, validRows, issues, headerWarnings };
}

export function parseStudentImportCsv(input: string): StudentImportRow[] {
  const analysis = analyzeStudentImportCsv(input);

  const firstError = analysis.issues.find((item) => item.severity === "error");
  if (firstError) throw new Error(`Row ${firstError.rowNumber}: ${firstError.message}`);
  return analysis.validRows;
}

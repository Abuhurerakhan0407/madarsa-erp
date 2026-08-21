export const studentNumberResetPeriods = ["never", "yearly", "session"] as const;
export type StudentNumberResetPeriod = (typeof studentNumberResetPeriods)[number];

export type StudentNumberingInput = {
  pattern: string;
  startValue: number;
  padding: number;
  resetPeriod: StudentNumberResetPeriod;
};

const supportedTokens = new Set(["{SEQ}", "{BRANCH}", "{SESSION}", "{YYYY}", "{YY}"]);
const patternCharacters = /^[A-Za-z0-9_./{}-]+$/;

function tokenCount(pattern: string, token: string): number {
  return pattern.split(token).length - 1;
}

export function validateStudentNumberingInput(body: unknown): {
  value?: StudentNumberingInput;
  errors: string[];
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: ["Request body must be an object."] };
  }

  const input = body as Record<string, unknown>;
  const pattern = typeof input.pattern === "string" ? input.pattern.trim() : "";
  const startValue = typeof input.startValue === "number" ? input.startValue : Number.NaN;
  const padding = typeof input.padding === "number" ? input.padding : Number.NaN;
  const resetPeriod = typeof input.resetPeriod === "string" ? input.resetPeriod : "";
  const errors: string[] = [];

  if (pattern.length < 3 || pattern.length > 160 || !patternCharacters.test(pattern)) {
    errors.push("Number pattern is invalid.");
  }

  const tokens = pattern.match(/\{[A-Z_]+\}/g) ?? [];
  const unsupported = [...new Set(tokens.filter((token) => !supportedTokens.has(token)))];
  if (unsupported.length > 0) {
    errors.push(`Unsupported number token: ${unsupported.join(", ")}.`);
  }

  if (tokenCount(pattern, "{SEQ}") !== 1) {
    errors.push("Number pattern must contain {SEQ} exactly once.");
  }

  if (!pattern.includes("{BRANCH}")) {
    errors.push("Branch-scoped student numbers must contain {BRANCH}.");
  }

  if (!studentNumberResetPeriods.includes(resetPeriod as StudentNumberResetPeriod)) {
    errors.push("Reset period is invalid.");
  } else if (resetPeriod === "yearly" && !pattern.includes("{YYYY}") && !pattern.includes("{YY}")) {
    errors.push("Yearly reset requires {YYYY} or {YY} in the pattern.");
  } else if (resetPeriod === "session" && !pattern.includes("{SESSION}")) {
    errors.push("Session reset requires {SESSION} in the pattern.");
  }

  if (!Number.isSafeInteger(startValue) || startValue < 1 || startValue > 999_999_999_999) {
    errors.push("Starting value must be a positive safe integer.");
  }

  if (!Number.isInteger(padding) || padding < 1 || padding > 12) {
    errors.push("Padding must be between 1 and 12 digits.");
  }

  if (errors.length > 0) return { errors };

  return {
    errors: [],
    value: {
      pattern,
      startValue,
      padding,
      resetPeriod: resetPeriod as StudentNumberResetPeriod
    }
  };
}

export function studentNumberPreview(input: StudentNumberingInput): string {
  const sequence = String(input.startValue).padStart(input.padding, "0");
  return input.pattern
    .replace("{SEQ}", sequence)
    .replaceAll("{BRANCH}", "MAIN")
    .replaceAll("{SESSION}", "2026_27")
    .replaceAll("{YYYY}", "2026")
    .replaceAll("{YY}", "26");
}

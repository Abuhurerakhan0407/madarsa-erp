export type QuranWorkCategory = "sabaq" | "sabqi" | "manzil" | "nazra" | "qaida" | "tajweed";
export type QuranOutcome = "passed" | "partial" | "repeat" | "excused" | "not_attempted";
export type QuranTargetMode = "juz" | "ayah" | "page";

export type QuranMistakeInput = { category: string; severity: number; count: number; note?: string };
export type QuranAttemptInput = {
  personId: number;
  workCategory: QuranWorkCategory;
  targetMode: QuranTargetMode;
  juzNumber?: number;
  startSurahNumber?: number;
  startAyahNumber?: number;
  endSurahNumber?: number;
  endAyahNumber?: number;
  pageStart?: number;
  pageEnd?: number;
  accuracyScore?: number;
  fluencyScore?: number;
  tajweedScore?: number;
  overallScore?: number;
  prompts?: number;
  outcome: QuranOutcome;
  teacherPersonId?: number;
  teacherRemark?: string;
  parentVisibleRemark?: string;
  privateNote?: string;
  mistakes: QuranMistakeInput[];
};

type ValidationResult = { value?: QuranAttemptInput; errors: string[] };
const WORK = new Set<QuranWorkCategory>(["sabaq","sabqi","manzil","nazra","qaida","tajweed"]);
const OUTCOMES = new Set<QuranOutcome>(["passed","partial","repeat","excused","not_attempted"]);
const MODES = new Set<QuranTargetMode>(["juz","ayah","page"]);

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function positiveInt(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
function score(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : undefined;
}
function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  if (!clean) return undefined;
  return clean.length <= max ? clean : undefined;
}

export function validateQuranAttemptInput(input: unknown): ValidationResult {
  const data = objectValue(input);
  if (!data) return { errors: ["Request body must be an object."] };
  const errors: string[] = [];
  const personId = positiveInt(data.personId);
  if (!personId) errors.push("Student is required.");
  const workCategory = typeof data.workCategory === "string" && WORK.has(data.workCategory as QuranWorkCategory) ? data.workCategory as QuranWorkCategory : undefined;
  if (!workCategory) errors.push("Qur'an work category is invalid.");
  const targetMode = typeof data.targetMode === "string" && MODES.has(data.targetMode as QuranTargetMode) ? data.targetMode as QuranTargetMode : undefined;
  if (!targetMode) errors.push("Target mode is invalid.");
  const outcome = typeof data.outcome === "string" && OUTCOMES.has(data.outcome as QuranOutcome) ? data.outcome as QuranOutcome : undefined;
  if (!outcome) errors.push("Outcome is invalid.");

  const juzNumber = positiveInt(data.juzNumber);
  const startSurahNumber = positiveInt(data.startSurahNumber);
  const startAyahNumber = positiveInt(data.startAyahNumber);
  const endSurahNumber = positiveInt(data.endSurahNumber);
  const endAyahNumber = positiveInt(data.endAyahNumber);
  const pageStart = positiveInt(data.pageStart);
  const pageEnd = positiveInt(data.pageEnd);
  if (targetMode === "juz" && (!juzNumber || juzNumber > 30)) errors.push("Juz must be between 1 and 30.");
  if (targetMode === "ayah") {
    if (!startSurahNumber || startSurahNumber > 114 || !endSurahNumber || endSurahNumber > 114 || !startAyahNumber || !endAyahNumber) errors.push("Valid Surah and Ayah range is required.");
    else if (endSurahNumber < startSurahNumber || (endSurahNumber === startSurahNumber && endAyahNumber < startAyahNumber)) errors.push("End Ayah must not be before the start.");
  }
  if (targetMode === "page" && (!pageStart || pageStart > 604 || !pageEnd || pageEnd > 604 || pageEnd < pageStart)) errors.push("Mushaf pages must be between 1 and 604 in order.");

  const accuracyScore = score(data.accuracyScore);
  const fluencyScore = score(data.fluencyScore);
  const tajweedScore = score(data.tajweedScore);
  let overallScore = score(data.overallScore);
  for (const [label, raw, parsed] of [["Accuracy",data.accuracyScore,accuracyScore],["Fluency",data.fluencyScore,fluencyScore],["Tajweed",data.tajweedScore,tajweedScore],["Overall",data.overallScore,overallScore]] as const) {
    if (raw !== undefined && raw !== null && raw !== "" && parsed === undefined) errors.push(`${label} score must be between 0 and 100.`);
  }
  if (overallScore === undefined) {
    const available = [accuracyScore,fluencyScore,tajweedScore].filter((value): value is number => value !== undefined);
    if (available.length) overallScore = Math.round((available.reduce((sum,value)=>sum+value,0)/available.length)*10)/10;
  }
  const prompts = data.prompts === "" || data.prompts === undefined || data.prompts === null ? undefined : Number(data.prompts);
  if (prompts !== undefined && (!Number.isInteger(prompts) || prompts < 0 || prompts > 999)) errors.push("Prompts must be a non-negative whole number.");
  const teacherPersonId = positiveInt(data.teacherPersonId);
  const teacherRemark = text(data.teacherRemark,1000);
  const parentVisibleRemark = text(data.parentVisibleRemark,1000);
  const privateNote = text(data.privateNote,1000);
  for (const [label,raw,parsed] of [["Teacher remark",data.teacherRemark,teacherRemark],["Parent remark",data.parentVisibleRemark,parentVisibleRemark],["Private note",data.privateNote,privateNote]] as const) {
    if (typeof raw === "string" && raw.trim() && !parsed) errors.push(`${label} is too long.`);
  }

  const mistakes: QuranMistakeInput[] = [];
  if (data.mistakes !== undefined) {
    if (!Array.isArray(data.mistakes) || data.mistakes.length > 25) errors.push("Mistakes must contain at most 25 entries.");
    else for (const raw of data.mistakes) {
      const mistake = objectValue(raw);
      if (!mistake) { errors.push("Each mistake must be an object."); continue; }
      const category = text(mistake.category,80);
      const severity = Number(mistake.severity ?? 1);
      const count = Number(mistake.count ?? 1);
      const note = text(mistake.note,300);
      if (!category || category.length < 2) errors.push("Mistake category is invalid.");
      else if (!Number.isInteger(severity) || severity < 1 || severity > 5) errors.push(`Severity for ${category} must be 1–5.`);
      else if (!Number.isInteger(count) || count < 1 || count > 99) errors.push(`Count for ${category} must be 1–99.`);
      else mistakes.push({ category, severity, count, ...(note ? { note } : {}) });
    }
  }

  if (errors.length || !personId || !workCategory || !targetMode || !outcome) return { errors };
  return { errors: [], value: {
    personId, workCategory, targetMode, outcome,
    ...(targetMode === "juz" ? { juzNumber } : {}),
    ...(targetMode === "ayah" ? { startSurahNumber,startAyahNumber,endSurahNumber,endAyahNumber } : {}),
    ...(targetMode === "page" ? { pageStart,pageEnd } : {}),
    ...(accuracyScore !== undefined ? { accuracyScore } : {}),
    ...(fluencyScore !== undefined ? { fluencyScore } : {}),
    ...(tajweedScore !== undefined ? { tajweedScore } : {}),
    ...(overallScore !== undefined ? { overallScore } : {}),
    ...(prompts !== undefined ? { prompts } : {}),
    ...(teacherPersonId ? { teacherPersonId } : {}),
    ...(teacherRemark ? { teacherRemark } : {}),
    ...(parentVisibleRemark ? { parentVisibleRemark } : {}),
    ...(privateNote ? { privateNote } : {}),
    mistakes
  }};
}

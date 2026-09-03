export const quranDailyActions = ["pass", "repeat", "needs_support", "absent", "no_lesson"] as const;
export type QuranDailyAction = (typeof quranDailyActions)[number];
export const quranDailyWorkCategories = ["sabaq", "sabqi", "manzil", "nazra", "qaida", "tajweed"] as const;
export type QuranDailyWorkCategory = (typeof quranDailyWorkCategories)[number];

export type QuranDailyTarget = {
  mode: "juz" | "ayah" | "page";
  juz_number?: number;
  start_surah_number?: number;
  start_ayah_number?: number;
  end_surah_number?: number;
  end_ayah_number?: number;
  page_start?: number;
  page_end?: number;
  work_category?: QuranDailyWorkCategory;
};

export type QuranDailyQuickInput = {
  requestKey: string;
  groupId: number;
  sessionDate: string;
  personId: number;
  workCategory: QuranDailyWorkCategory;
  action: QuranDailyAction;
  target?: QuranDailyTarget;
  qualityScore?: number;
  tajweedScore?: number;
  fluencyScore?: number;
  mistakeCount: number;
  teacherNote?: string;
  nextTarget?: QuranDailyTarget;
  revisionDueOn?: string;
};

type Result = { value: QuranDailyQuickInput | null; errors: string[] };
const ACTIONS = new Set<string>(quranDailyActions);
const WORK = new Set<string>(quranDailyWorkCategories);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED = new Set([
  "requestKey","groupId","sessionDate","personId","workCategory","action","target","qualityScore","tajweedScore","fluencyScore","mistakeCount","teacherNote","nextTarget","revisionDueOn"
]);

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function positiveInt(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function score(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : undefined;
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean && clean.length <= max ? clean : undefined;
}

function validDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !DATE.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0,10) !== value) return undefined;
  return value;
}

export function validateQuranDailyTarget(value: unknown, allowWorkCategory = false): { value?: QuranDailyTarget; error?: string } {
  const data = objectValue(value);
  if (!data) return { error: "Qur'an target must be an object." };
  const mode = data.mode;
  if (mode !== "juz" && mode !== "ayah" && mode !== "page") return { error: "Qur'an target mode is invalid." };
  const workCategory = allowWorkCategory && typeof data.work_category === "string" && WORK.has(data.work_category)
    ? data.work_category as QuranDailyWorkCategory
    : undefined;
  if (allowWorkCategory && data.work_category !== undefined && !workCategory) return { error: "Next target work category is invalid." };

  const target: QuranDailyTarget = { mode, ...(workCategory ? { work_category: workCategory } : {}) };
  if (mode === "juz") {
    const juz = positiveInt(data.juz_number);
    if (!juz || juz > 30) return { error: "Juz target must be between 1 and 30." };
    target.juz_number = juz;
  } else if (mode === "ayah") {
    const ss = positiveInt(data.start_surah_number);
    const sa = positiveInt(data.start_ayah_number);
    const es = positiveInt(data.end_surah_number);
    const ea = positiveInt(data.end_ayah_number);
    if (!ss || ss > 114 || !es || es > 114 || !sa || !ea || es < ss || (es === ss && ea < sa)) {
      return { error: "Valid Surah and Ayah range is required." };
    }
    Object.assign(target, { start_surah_number:ss,start_ayah_number:sa,end_surah_number:es,end_ayah_number:ea });
  } else {
    const start = positiveInt(data.page_start);
    const end = positiveInt(data.page_end);
    if (!start || !end || start > 604 || end > 604 || end < start) return { error: "Mushaf page target must be between 1 and 604 in order." };
    Object.assign(target, { page_start:start,page_end:end });
  }
  return { value: target };
}

export function validateQuranDailyQuickInput(input: unknown): Result {
  const data = objectValue(input);
  if (!data) return { value: null, errors: ["Request body must be an object."] };
  const errors: string[] = [];
  if (Object.keys(data).some((key) => !ALLOWED.has(key))) errors.push("Daily register request contains unsupported fields.");

  const requestKey = text(data.requestKey, 96);
  if (!requestKey || requestKey.length < 16) errors.push("Valid request key required.");
  const groupId = positiveInt(data.groupId);
  if (!groupId) errors.push("Halaqah or group is required.");
  const personId = positiveInt(data.personId);
  if (!personId) errors.push("Student is required.");
  const sessionDate = validDate(data.sessionDate);
  if (!sessionDate) errors.push("Valid lesson date is required.");
  const workCategory = typeof data.workCategory === "string" && WORK.has(data.workCategory)
    ? data.workCategory as QuranDailyWorkCategory
    : undefined;
  if (!workCategory) errors.push("Qur'an work category is invalid.");
  const action = typeof data.action === "string" && ACTIONS.has(data.action)
    ? data.action as QuranDailyAction
    : undefined;
  if (!action) errors.push("Daily register action is invalid.");

  const qualityScore = score(data.qualityScore);
  const tajweedScore = score(data.tajweedScore);
  const fluencyScore = score(data.fluencyScore);
  for (const [label, raw, parsed] of [
    ["Quality",data.qualityScore,qualityScore],
    ["Tajweed",data.tajweedScore,tajweedScore],
    ["Fluency",data.fluencyScore,fluencyScore]
  ] as const) {
    if (raw !== undefined && raw !== null && raw !== "" && parsed === undefined) errors.push(`${label} score must be between 0 and 100.`);
  }

  const mistakeCount = data.mistakeCount === undefined || data.mistakeCount === "" ? 0 : Number(data.mistakeCount);
  if (!Number.isInteger(mistakeCount) || mistakeCount < 0 || mistakeCount > 99) errors.push("Mistake count must be between 0 and 99.");
  const teacherNote = text(data.teacherNote, 1000);
  if (typeof data.teacherNote === "string" && data.teacherNote.trim() && !teacherNote) errors.push("Teacher note is too long.");
  const revisionDueOn = data.revisionDueOn === undefined || data.revisionDueOn === "" ? undefined : validDate(data.revisionDueOn);
  if (data.revisionDueOn !== undefined && data.revisionDueOn !== "" && !revisionDueOn) errors.push("Revision due date is invalid.");
  if (sessionDate && revisionDueOn && revisionDueOn < sessionDate) errors.push("Revision due date cannot be before the lesson date.");

  const targetResult = data.target === undefined || data.target === null ? {} : validateQuranDailyTarget(data.target);
  if (targetResult.error) errors.push(targetResult.error);
  const nextTargetResult = data.nextTarget === undefined || data.nextTarget === null ? {} : validateQuranDailyTarget(data.nextTarget, true);
  if (nextTargetResult.error) errors.push(nextTargetResult.error);

  if (errors.length || !requestKey || !groupId || !personId || !sessionDate || !workCategory || !action) return { value: null, errors };
  return {
    errors: [],
    value: {
      requestKey, groupId, sessionDate, personId, workCategory, action,
      ...(targetResult.value ? { target: targetResult.value } : {}),
      ...(qualityScore !== undefined ? { qualityScore } : {}),
      ...(tajweedScore !== undefined ? { tajweedScore } : {}),
      ...(fluencyScore !== undefined ? { fluencyScore } : {}),
      mistakeCount,
      ...(teacherNote ? { teacherNote } : {}),
      ...(nextTargetResult.value ? { nextTarget: nextTargetResult.value } : {}),
      ...(revisionDueOn ? { revisionDueOn } : {})
    }
  };
}

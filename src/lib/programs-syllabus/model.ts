export const programTemplateKeys = [
  "hifz",
  "nazra",
  "amma_para",
  "deeniyat",
  "kitab",
  "dars_e_nizami",
  "general_academic",
  "blank_custom"
] as const;

export const programTypes = ["general", "hifz", "nazra", "qaida", "dars_e_nizami", "custom"] as const;
export const subjectTypes = ["academic", "language", "quran", "traditional", "activity", "custom"] as const;
export const progressMethods = [
  "completion",
  "percentage",
  "rating",
  "score",
  "marks",
  "memorization",
  "range",
  "checklist",
  "rubric",
  "pass_repeat",
  "custom"
] as const;
export const unitStructures = ["juz", "surah", "ayah_range", "chapter", "lesson", "topic", "book", "custom_unit"] as const;
export const progressStates = ["not_started", "in_progress", "completed", "passed", "repeat", "needs_support", "skipped"] as const;

type LocalizedText = { en: string; ur?: string };

type CreateProgramMutation = {
  action: "create_program";
  key: string;
  labels: LocalizedText;
  descriptions: LocalizedText;
  programType: (typeof programTypes)[number];
  templateKey: (typeof programTemplateKeys)[number];
};

type AddLevelMutation = {
  action: "add_level";
  programId: number;
  key: string;
  labels: LocalizedText;
  sequence: number;
};

type AddComponentMutation = {
  action: "add_component";
  programId: number;
  levelId: number | null;
  subjectKey: string;
  subjectLabels: LocalizedText;
  subjectType: (typeof subjectTypes)[number];
  progressMethod: (typeof progressMethods)[number];
  unitStructure: (typeof unitStructures)[number];
};

type AddUnitMutation = {
  action: "add_unit";
  curriculumItemId: number;
  parentUnitId: number | null;
  key: string;
  labels: LocalizedText;
  sequence: number;
  expectedPeriods: number | null;
};

type PublishMutation = { action: "publish"; programId: number };

type AssignMutation = {
  action: "assign";
  sessionId: number;
  curriculumItemId: number;
  groupId: number | null;
  studentPersonId: number | null;
  teacherPersonId: number;
  evaluationMethod: (typeof progressMethods)[number];
  startsOn: string;
  endsOn: string | null;
};

type RecordProgressMutation = {
  action: "record_progress";
  assignmentId: number;
  studentPersonId: number;
  curriculumUnitId: number;
  teacherPersonId: number;
  state: (typeof progressStates)[number];
  progressValue: Record<string, unknown>;
  notes: string;
};

export type ProgramsSyllabusMutation =
  | CreateProgramMutation
  | AddLevelMutation
  | AddComponentMutation
  | AddUnitMutation
  | PublishMutation
  | AssignMutation
  | RecordProgressMutation;

const keyPattern = /^[a-z][a-z0-9_]{1,63}$/;
const levelKeyPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function positiveInt(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function nonNegativeInt(value: unknown, max: number): number | null {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max ? Number(value) : null;
}

function nullablePositiveInt(value: unknown): number | null | undefined {
  if (value === null || value === "" || value === undefined) return null;
  const parsed = positiveInt(value);
  return parsed ?? undefined;
}

function enumValue<T extends readonly string[]>(value: unknown, values: T): T[number] | null {
  return typeof value === "string" && values.includes(value as T[number]) ? value as T[number] : null;
}

function localizedText(value: unknown, max = 240): LocalizedText | null {
  const input = asRecord(value);
  if (!input) return null;
  const en = typeof input.en === "string" ? input.en.trim() : "";
  const ur = typeof input.ur === "string" ? input.ur.trim() : "";
  if (en.length < 1 || en.length > max || ur.length > max) return null;
  return { en, ...(ur ? { ur } : {}) };
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || !datePattern.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value ? value : null;
}

export function validateProgramsSyllabusMutation(body: unknown): { value?: ProgramsSyllabusMutation; errors: string[] } {
  const input = asRecord(body);
  if (!input) return { errors: ["Request body must be an object."] };
  const action = typeof input.action === "string" ? input.action : "";

  if (action === "create_program") {
    const key = typeof input.key === "string" ? input.key.trim().toLowerCase() : "";
    const labels = localizedText(input.labels, 120);
    const descriptions = localizedText(input.descriptions, 1000);
    const programType = enumValue(input.programType, programTypes);
    const templateKey = enumValue(input.templateKey, programTemplateKeys);
    const errors: string[] = [];
    if (!keyPattern.test(key)) errors.push("Program key is invalid.");
    if (!labels) errors.push("Program labels are invalid.");
    if (!descriptions) errors.push("Program description is invalid.");
    if (!programType) errors.push("Program type is invalid.");
    if (!templateKey) errors.push("Program template is invalid.");
    return errors.length ? { errors } : { errors: [], value: { action, key, labels: labels!, descriptions: descriptions!, programType: programType!, templateKey: templateKey! } };
  }

  if (action === "add_level") {
    const programId = positiveInt(input.programId);
    const key = typeof input.key === "string" ? input.key.trim().toLowerCase() : "";
    const labels = localizedText(input.labels, 120);
    const sequence = nonNegativeInt(input.sequence, 500);
    const errors: string[] = [];
    if (!programId) errors.push("Program is required.");
    if (!levelKeyPattern.test(key)) errors.push("Level key is invalid.");
    if (!labels) errors.push("Level labels are invalid.");
    if (sequence === null) errors.push("Level sequence is invalid.");
    return errors.length ? { errors } : { errors: [], value: { action, programId: programId!, key, labels: labels!, sequence: sequence! } };
  }

  if (action === "add_component") {
    const programId = positiveInt(input.programId);
    const levelId = nullablePositiveInt(input.levelId);
    const subjectKey = typeof input.subjectKey === "string" ? input.subjectKey.trim().toLowerCase() : "";
    const subjectLabels = localizedText(input.subjectLabels, 120);
    const subjectType = enumValue(input.subjectType, subjectTypes);
    const progressMethod = enumValue(input.progressMethod, progressMethods);
    const unitStructure = enumValue(input.unitStructure, unitStructures);
    const errors: string[] = [];
    if (!programId) errors.push("Program is required.");
    if (levelId === undefined) errors.push("Level selection is invalid.");
    if (!keyPattern.test(subjectKey)) errors.push("Subject key is invalid.");
    if (!subjectLabels) errors.push("Subject labels are invalid.");
    if (!subjectType) errors.push("Subject type is invalid.");
    if (!progressMethod) errors.push("Progress method is invalid.");
    if (!unitStructure) errors.push("Unit structure is invalid.");
    return errors.length ? { errors } : { errors: [], value: { action, programId: programId!, levelId: levelId!, subjectKey, subjectLabels: subjectLabels!, subjectType: subjectType!, progressMethod: progressMethod!, unitStructure: unitStructure! } };
  }

  if (action === "add_unit") {
    const curriculumItemId = positiveInt(input.curriculumItemId);
    const parentUnitId = nullablePositiveInt(input.parentUnitId);
    const key = typeof input.key === "string" ? input.key.trim() : "";
    const labels = localizedText(input.labels, 160);
    const sequence = nonNegativeInt(input.sequence, 5000);
    const expectedPeriods = input.expectedPeriods === null || input.expectedPeriods === "" || input.expectedPeriods === undefined ? null : Number(input.expectedPeriods);
    const errors: string[] = [];
    if (!curriculumItemId) errors.push("Curriculum component is required.");
    if (parentUnitId === undefined) errors.push("Parent unit selection is invalid.");
    if (key.length < 1 || key.length > 80) errors.push("Unit key is invalid.");
    if (!labels) errors.push("Unit labels are invalid.");
    if (sequence === null) errors.push("Unit sequence is invalid.");
    if (expectedPeriods !== null && (!Number.isFinite(expectedPeriods) || expectedPeriods < 0 || expectedPeriods > 1000)) errors.push("Expected periods are invalid.");
    return errors.length ? { errors } : { errors: [], value: { action, curriculumItemId: curriculumItemId!, parentUnitId: parentUnitId!, key, labels: labels!, sequence: sequence!, expectedPeriods } };
  }

  if (action === "publish") {
    const programId = positiveInt(input.programId);
    return programId ? { errors: [], value: { action, programId } } : { errors: ["Program is required."] };
  }

  if (action === "assign") {
    const sessionId = positiveInt(input.sessionId);
    const curriculumItemId = positiveInt(input.curriculumItemId);
    const groupId = nullablePositiveInt(input.groupId);
    const studentPersonId = nullablePositiveInt(input.studentPersonId);
    const teacherPersonId = positiveInt(input.teacherPersonId);
    const evaluationMethod = enumValue(input.evaluationMethod, progressMethods);
    const startsOn = isoDate(input.startsOn);
    const endsOn = input.endsOn === null || input.endsOn === "" || input.endsOn === undefined ? null : isoDate(input.endsOn);
    const errors: string[] = [];
    if (!sessionId) errors.push("Academic session is required.");
    if (!curriculumItemId) errors.push("Published curriculum component is required.");
    if (groupId === undefined || studentPersonId === undefined || Number(groupId !== null) + Number(studentPersonId !== null) !== 1) errors.push("Select exactly one group or student target.");
    if (!teacherPersonId) errors.push("Teacher is required.");
    if (!evaluationMethod) errors.push("Evaluation method is invalid.");
    if (!startsOn) errors.push("Start date is invalid.");
    if (input.endsOn && !endsOn) errors.push("End date is invalid.");
    if (startsOn && endsOn && endsOn < startsOn) errors.push("End date cannot be before start date.");
    return errors.length ? { errors } : { errors: [], value: { action, sessionId: sessionId!, curriculumItemId: curriculumItemId!, groupId: groupId!, studentPersonId: studentPersonId!, teacherPersonId: teacherPersonId!, evaluationMethod: evaluationMethod!, startsOn: startsOn!, endsOn } };
  }

  if (action === "record_progress") {
    const assignmentId = positiveInt(input.assignmentId);
    const studentPersonId = positiveInt(input.studentPersonId);
    const curriculumUnitId = positiveInt(input.curriculumUnitId);
    const teacherPersonId = positiveInt(input.teacherPersonId);
    const state = enumValue(input.state, progressStates);
    const progressValue = asRecord(input.progressValue);
    const notes = typeof input.notes === "string" ? input.notes.trim() : "";
    const errors: string[] = [];
    if (!assignmentId) errors.push("Teaching assignment is required.");
    if (!studentPersonId) errors.push("Student is required.");
    if (!curriculumUnitId) errors.push("Curriculum unit is required.");
    if (!teacherPersonId) errors.push("Teacher is required.");
    if (!state) errors.push("Progress state is invalid.");
    if (!progressValue || JSON.stringify(progressValue).length > 4000) errors.push("Progress value is invalid.");
    if (notes.length > 2000) errors.push("Progress notes are too long.");
    return errors.length ? { errors } : { errors: [], value: { action, assignmentId: assignmentId!, studentPersonId: studentPersonId!, curriculumUnitId: curriculumUnitId!, teacherPersonId: teacherPersonId!, state: state!, progressValue: progressValue!, notes } };
  }

  return { errors: ["Unsupported Programs & Syllabus action."] };
}

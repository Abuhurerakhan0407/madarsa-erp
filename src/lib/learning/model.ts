export type QuranReference = {
  surah: number;
  ayah: number;
  word?: number;
};

export type QuranPortion = {
  start: QuranReference;
  end: QuranReference;
  editionKey: string;
};

export type RecitationOutcome = "passed" | "partial" | "repeat" | "excused" | "not_attempted";

export type RecitationMistake = {
  category: string;
  reference?: QuranReference;
  severity: number;
  teacherConfirmedRepeated?: boolean;
};

export type RecitationAttempt = {
  id: string;
  studentPersonId: string;
  occurredAt: string;
  portion: QuranPortion;
  workCategory: string;
  accuracy: number;
  fluency: number;
  tajweed: number;
  prompts: number;
  outcome: RecitationOutcome;
  mistakes: readonly RecitationMistake[];
};

export type StrengthExplanation = {
  score: number;
  state: "strong" | "due" | "weak" | "critical";
  factors: readonly string[];
};

export type ReadingUnit = {
  id: string;
  sequence: number;
  prerequisiteUnitIds: readonly string[];
};

import type { QuranPortion, QuranReference, ReadingUnit, RecitationAttempt, RecitationMistake, StrengthExplanation } from "./model";

export function referenceOrdinal(reference: QuranReference): number {
  if (reference.surah < 1 || reference.surah > 114 || reference.ayah < 1) {
    throw new Error("Invalid Quran reference");
  }
  return reference.surah * 100_000 + reference.ayah * 100 + (reference.word ?? 0);
}

export function validatePortion(portion: QuranPortion): string[] {
  const issues: string[] = [];
  try {
    if (referenceOrdinal(portion.end) < referenceOrdinal(portion.start)) issues.push("portion_reversed");
  } catch {
    issues.push("invalid_reference");
  }
  if (portion.editionKey.trim().length < 2) issues.push("edition_required");
  return issues;
}

export function repeatedMistakes(
  attempts: readonly RecitationAttempt[],
  windowDays: number,
  now: Date
): Array<{ key: string; count: number; mistakes: readonly RecitationMistake[] }> {
  const cutoff = now.getTime() - windowDays * 86_400_000;
  const groups = new Map<string, RecitationMistake[]>();

  for (const attempt of attempts) {
    if (Date.parse(attempt.occurredAt) < cutoff) continue;
    for (const mistake of attempt.mistakes) {
      const reference = mistake.reference ? referenceOrdinal(mistake.reference) : "general";
      const key = `${mistake.category}:${reference}`;
      groups.set(key, [...(groups.get(key) ?? []), mistake]);
    }
  }

  return [...groups.entries()]
    .filter(([, mistakes]) => mistakes.length >= 2 || mistakes.some((item) => item.teacherConfirmedRepeated))
    .map(([key, mistakes]) => ({ key, count: mistakes.length, mistakes }));
}

export function explainStrength(
  attempts: readonly RecitationAttempt[],
  daysSinceRevision: number,
  overdueDays: number
): StrengthExplanation {
  if (attempts.length === 0) return { score: 0, state: "critical", factors: ["no_recent_attempts"] };

  const recent = attempts.slice(-5);
  const average = recent.reduce((total, attempt) => total + attempt.accuracy + attempt.fluency + attempt.tajweed, 0) / (recent.length * 3);
  const severeMistakes = recent.flatMap((attempt) => attempt.mistakes).filter((mistake) => mistake.severity >= 3).length;
  const score = Math.max(0, Math.min(100, Math.round(average - severeMistakes * 4 - overdueDays * 1.5 - Math.max(0, daysSinceRevision - 14))));
  const factors = [`recent_average:${Math.round(average)}`, `severe_mistakes:${severeMistakes}`, `overdue_days:${overdueDays}`, `days_since_revision:${daysSinceRevision}`];
  const state = score >= 80 ? "strong" : score >= 60 ? "due" : score >= 35 ? "weak" : "critical";
  return { score, state, factors };
}

export function canAdvanceReadingUnit(completedUnitIds: ReadonlySet<string>, next: ReadingUnit): boolean {
  return next.prerequisiteUnitIds.every((id) => completedUnitIds.has(id));
}

export type AcademicProgramRow = {
  id: number;
  key: string;
  labels: Record<string, string> | null;
};

export type AcademicGroupRow = {
  program_id: number | null;
};

export type AcademicEnrollmentRow = {
  program_id: number | null;
  student_person_id: number;
};

export type ProgramSummaryRow = {
  id: number;
  key: string;
  label: string;
  groups: number;
  students: number;
};

function localizedLabel(
  labels: Record<string, string> | null,
  locale: string,
  fallback: string
): string {
  return (
    labels?.[locale] ??
    labels?.en ??
    Object.values(labels ?? {})[0] ??
    fallback
  );
}

export function buildProgramSummary(
  programs: AcademicProgramRow[],
  groups: AcademicGroupRow[],
  enrollments: AcademicEnrollmentRow[],
  locale: string
): ProgramSummaryRow[] {
  const groupCounts = new Map<number, number>();
  for (const group of groups) {
    if (!group.program_id) continue;
    groupCounts.set(group.program_id, (groupCounts.get(group.program_id) ?? 0) + 1);
  }

  const studentsByProgram = new Map<number, Set<number>>();
  for (const enrollment of enrollments) {
    if (!enrollment.program_id) continue;
    const students = studentsByProgram.get(enrollment.program_id) ?? new Set<number>();
    students.add(enrollment.student_person_id);
    studentsByProgram.set(enrollment.program_id, students);
  }

  return programs
    .map((program) => ({
      id: program.id,
      key: program.key,
      label: localizedLabel(program.labels, locale, program.key),
      groups: groupCounts.get(program.id) ?? 0,
      students: studentsByProgram.get(program.id)?.size ?? 0
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

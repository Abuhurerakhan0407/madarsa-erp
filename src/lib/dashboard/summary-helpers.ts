export type ProgramAttendance = {
  id: number;
  key: string;
  label: string;
  value: number;
};

export type ProgramRow = {
  id: number;
  key: string;
  labels: Record<string, string> | null;
};

export type AttendanceRow = {
  enrollment_id: number | null;
  presence_ratio: number | string | null;
};

export type EnrollmentRow = {
  id: number;
  program_id: number | null;
};

export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function aggregateProgramAttendance(
  programs: ProgramRow[],
  records: AttendanceRow[],
  enrollments: EnrollmentRow[],
  locale: string
): ProgramAttendance[] {
  const enrollmentProgram = new Map(
    enrollments.map((enrollment) => [enrollment.id, enrollment.program_id])
  );
  const totals = new Map<number, { sum: number; count: number }>();

  for (const record of records) {
    if (!record.enrollment_id) continue;
    const programId = enrollmentProgram.get(record.enrollment_id);
    if (!programId) continue;

    const ratio = Number(record.presence_ratio ?? 0);
    if (!Number.isFinite(ratio)) continue;

    const current = totals.get(programId) ?? { sum: 0, count: 0 };
    current.sum += Math.max(0, Math.min(1, ratio));
    current.count += 1;
    totals.set(programId, current);
  }

  return programs
    .map((program) => {
      const total = totals.get(program.id);
      const value = total?.count ? Math.round((total.sum / total.count) * 100) : 0;
      const label =
        program.labels?.[locale] ??
        program.labels?.en ??
        Object.values(program.labels ?? {})[0] ??
        program.key;

      return { id: program.id, key: program.key, label, value };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

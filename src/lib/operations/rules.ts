export type DateRange = { startsOn: string; endsOn?: string };

export function rangesOverlap(left: DateRange, right: DateRange): boolean {
  const leftEnd = left.endsOn ?? "9999-12-31";
  const rightEnd = right.endsOn ?? "9999-12-31";
  return left.startsOn <= rightEnd && right.startsOn <= leftEnd;
}

export function validateCapacity(capacity: number, activeAssignments: number, requested = 1): string[] {
  if (capacity <= 0) return ["invalid_capacity"];
  return activeAssignments + requested > capacity ? ["capacity_exceeded"] : [];
}

export function payrollNetMinor(earnings: readonly bigint[], deductions: readonly bigint[]): { gross: bigint; deductions: bigint; net: bigint } {
  const gross = earnings.reduce((sum, value) => sum + value, 0n);
  const deductionTotal = deductions.reduce((sum, value) => sum + value, 0n);
  return { gross, deductions: deductionTotal, net: gross - deductionTotal };
}

export function payrollAnomalies(input: { bankMissing: boolean; salaryMissing: boolean; attendanceUnresolved: boolean; netMinor: bigint; duplicate: boolean }): string[] {
  return [
    input.bankMissing && "missing_bank_details",
    input.salaryMissing && "missing_salary_structure",
    input.attendanceUnresolved && "unresolved_attendance",
    input.netMinor < 0n && "negative_net_pay",
    input.duplicate && "duplicate_employee"
  ].filter((value): value is string => Boolean(value));
}

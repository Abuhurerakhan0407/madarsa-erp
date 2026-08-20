import type {
  ComponentEntry,
  ComponentRule,
  MarksheetState,
  PromotionChoice,
  SubjectResult,
  SubjectResultInput
} from "./model";

const transitions: Record<MarksheetState, readonly MarksheetState[]> = {
  not_started: ["draft"],
  draft: ["submitted"],
  submitted: ["moderated", "approved", "reopened"],
  moderated: ["approved", "reopened"],
  approved: ["locked", "reopened"],
  locked: ["published", "reopened"],
  published: ["reopened"],
  reopened: ["draft", "submitted"]
};

export function canTransitionMarksheet(from: MarksheetState, to: MarksheetState, reason?: string): boolean {
  if (!transitions[from].includes(to)) return false;
  return to !== "reopened" || (reason?.trim().length ?? 0) >= 4;
}

export function validateComponents(components: readonly ComponentRule[]): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  let weight = 0;
  for (const component of components) {
    if (ids.has(component.id)) issues.push(`duplicate_component:${component.id}`);
    ids.add(component.id);
    if (component.maximumMarks <= 0) issues.push(`invalid_maximum:${component.id}`);
    if (component.passMarks !== undefined && (component.passMarks < 0 || component.passMarks > component.maximumMarks)) {
      issues.push(`invalid_pass_marks:${component.id}`);
    }
    if (component.weight <= 0) issues.push(`invalid_weight:${component.id}`);
    weight += component.weight;
  }
  if (Math.abs(weight - 100) > 0.0001) issues.push("component_weights_must_total_100");
  return issues;
}

export function validateEntry(entry: ComponentEntry, rule: ComponentRule): string[] {
  const issues: string[] = [];
  if (entry.componentId !== rule.id) issues.push("component_mismatch");
  if (entry.status === "present") {
    if (entry.rawMarks === undefined) issues.push("marks_required");
    else if (entry.rawMarks < 0 || entry.rawMarks > rule.maximumMarks) issues.push("marks_out_of_range");
  } else if (entry.rawMarks !== undefined) {
    issues.push("marks_not_allowed_for_status");
  }
  return issues;
}

function roundHalfUp(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateSubjectResult(input: SubjectResultInput, decimalPlaces = 2): SubjectResult {
  const componentIssues = validateComponents(input.components);
  if (componentIssues.length) throw new Error(componentIssues.join(","));
  const byComponent = new Map(input.entries.map((entry) => [entry.componentId, entry]));
  const trace: string[] = [];
  let rawMarks = 0;
  let normalizedMarks = 0;
  let weightedMarks = 0;
  let failedRequired = false;
  let allExempt = true;

  for (const rule of input.components) {
    const entry = byComponent.get(rule.id);
    if (!entry) return { subjectId: input.subjectId, rawMarks: null, normalizedMarks: null, weightedMarks: null, outcome: "incomplete", trace: [...trace, `missing:${rule.id}`] };
    const entryIssues = validateEntry(entry, rule);
    if (entryIssues.length) throw new Error(entryIssues.join(","));
    if (entry.status === "withheld") return { subjectId: input.subjectId, rawMarks: null, normalizedMarks: null, weightedMarks: null, outcome: "withheld", trace: [...trace, `withheld:${rule.id}`] };
    if (entry.status === "incomplete" || entry.status === "absent") {
      return { subjectId: input.subjectId, rawMarks: null, normalizedMarks: null, weightedMarks: null, outcome: "incomplete", trace: [...trace, `${entry.status}:${rule.id}`] };
    }
    if (entry.status === "exempt") {
      trace.push(`exempt:${rule.id}`);
      continue;
    }
    allExempt = false;
    const marks = entry.rawMarks ?? 0;
    const normalized = (marks / rule.maximumMarks) * 100;
    rawMarks += marks;
    normalizedMarks += normalized;
    weightedMarks += normalized * (rule.weight / 100);
    if (rule.required && rule.passMarks !== undefined && marks < rule.passMarks) failedRequired = true;
    trace.push(`${rule.id}:${marks}/${rule.maximumMarks}@${rule.weight}`);
  }

  if (allExempt) return { subjectId: input.subjectId, rawMarks: null, normalizedMarks: null, weightedMarks: null, outcome: "exempt", trace };
  const roundedWeighted = roundHalfUp(weightedMarks, decimalPlaces);
  trace.push(`rounded_half_up:${roundedWeighted}`);
  return {
    subjectId: input.subjectId,
    rawMarks: roundHalfUp(rawMarks, decimalPlaces),
    normalizedMarks: roundHalfUp(normalizedMarks / input.components.length, decimalPlaces),
    weightedMarks: roundedWeighted,
    outcome: failedRequired ? "fail" : "pass",
    trace
  };
}

export function validatePromotion(
  recommendation: PromotionChoice,
  decision: PromotionChoice,
  reason?: string,
  targetEnrollmentConflict = false
): string[] {
  const issues: string[] = [];
  if (decision !== recommendation && (reason?.trim().length ?? 0) < 4) issues.push("exception_reason_required");
  if ((decision === "promote" || decision === "transfer") && targetEnrollmentConflict) issues.push("target_enrollment_conflict");
  return issues;
}

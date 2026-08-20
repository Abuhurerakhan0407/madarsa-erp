export type MarkStatus = "present" | "absent" | "exempt" | "incomplete" | "withheld";
export type MarksheetState =
  | "not_started"
  | "draft"
  | "submitted"
  | "moderated"
  | "approved"
  | "locked"
  | "published"
  | "reopened";

export type ComponentRule = {
  id: string;
  maximumMarks: number;
  passMarks?: number;
  weight: number;
  required: boolean;
};

export type ComponentEntry = {
  componentId: string;
  status: MarkStatus;
  rawMarks?: number;
};

export type SubjectResultInput = {
  subjectId: string;
  components: readonly ComponentRule[];
  entries: readonly ComponentEntry[];
};

export type SubjectResult = {
  subjectId: string;
  rawMarks: number | null;
  normalizedMarks: number | null;
  weightedMarks: number | null;
  outcome: "pass" | "fail" | "incomplete" | "withheld" | "exempt";
  trace: readonly string[];
};

export type PromotionChoice = "promote" | "retain" | "transfer" | "complete" | "defer";

// Arabic remains a legacy internal label key for historical configuration rows.
// New commercial configuration drafts are emitted only for English and Urdu.
export const configurationLocales = ["en", "ur", "ar"] as const;
export const releaseConfigurationLocales = ["en", "ur"] as const;
export type ConfigurationLocale = (typeof configurationLocales)[number];
export type ReleaseConfigurationLocale = (typeof releaseConfigurationLocales)[number];

export type LocalizedLabels = Record<ConfigurationLocale, string>;

export const customFieldTypes = [
  "short_text",
  "long_text",
  "number",
  "currency",
  "date",
  "date_time",
  "dropdown",
  "multi_select",
  "boolean",
  "phone",
  "email",
  "url",
  "file",
  "entity_reference",
  "calculated_display"
] as const;

export type CustomFieldType = (typeof customFieldTypes)[number];

export const customFieldEntities = [
  "student",
  "guardian",
  "employee",
  "admission_application",
  "enrollment",
  "donor",
  "donation",
  "sponsorship"
] as const;

export type CustomFieldEntity = (typeof customFieldEntities)[number];

export type SafeRule = {
  fieldKey: string;
  operator: "equals" | "not_equals" | "in" | "not_in" | "is_empty" | "is_not_empty";
  value?: string | number | boolean | readonly (string | number)[];
};

export type CustomFieldDraft = {
  key: string;
  entity: CustomFieldEntity;
  type: CustomFieldType;
  labels: LocalizedLabels;
  required: boolean;
  options?: readonly string[];
  relationTarget?: CustomFieldEntity;
  visibilityRules?: readonly SafeRule[];
  validation?: Record<string, unknown>;
};

export type TerminologyEntry = {
  conceptKey: string;
  singular: LocalizedLabels;
  plural: LocalizedLabels;
};

export type StatusNode = {
  key: string;
  labels: LocalizedLabels;
  terminal?: boolean;
  coreSemantic?: boolean;
};

export type StatusTransition = {
  from: string;
  to: string;
  permission: `${string}.${string}.${string}`;
  requiresReason?: boolean;
};

export type GradeBand = {
  key: string;
  minimum: number;
  maximum: number;
  label: LocalizedLabels;
  passing: boolean;
  gradePoint?: number;
};

export type NumberSequenceDraft = {
  pattern: string;
  padding: number;
  nextValue: number;
  branch: string;
  session: string;
  year: string;
  type: string;
};

export type ConfigurationModuleState = {
  key:
    | "institution"
    | "branches"
    | "languages"
    | "calendar"
    | "academics"
    | "terminology"
    | "grading"
    | "attendance"
    | "fees"
    | "roles"
    | "notifications";
  complete: boolean;
  blockers?: readonly string[];
};

export type ConfigurationPreset = {
  key: "maktab" | "hifz_academy" | "dars_e_nizami" | "islamic_school" | "urdu_medium_school";
  name: LocalizedLabels;
  terminology: readonly TerminologyEntry[];
  enabledDomains: readonly string[];
  defaultAttendanceStatuses: readonly string[];
};

export type ValidationResult = {
  valid: boolean;
  errors: readonly string[];
};

import {
  configurationLocales,
  customFieldEntities,
  customFieldTypes,
  type ConfigurationModuleState,
  type CustomFieldDraft,
  type GradeBand,
  type LocalizedLabels,
  type NumberSequenceDraft,
  type StatusNode,
  type StatusTransition,
  type TerminologyEntry,
  type ValidationResult
} from "./model";

const stableKeyPattern = /^[a-z][a-z0-9_]{1,63}$/;
const permissionPattern = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;
const unsafeKeys = new Set(["code", "script", "sql", "webhook", "javascript", "function", "eval"]);
const allowedNumberTokens = new Set(["BRANCH", "SESSION", "YEAR", "TYPE", "COUNTER"]);

function result(errors: string[]): ValidationResult {
  return { valid: errors.length === 0, errors };
}

export function validateLocalizedLabels(labels: LocalizedLabels, path = "labels"): ValidationResult {
  const errors: string[] = [];

  for (const locale of configurationLocales) {
    const value = labels[locale]?.trim();
    if (!value) {
      errors.push(`${path}.${locale} is required`);
    } else if (value.length > 120) {
      errors.push(`${path}.${locale} exceeds 120 characters`);
    }
  }

  return result(errors);
}

function findUnsafeMetadata(value: unknown, path = "validation"): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value);

  return entries.flatMap(([key, child]) => {
    const childPath = `${path}.${key}`;
    const current = unsafeKeys.has(key.toLowerCase())
      ? [`${childPath} uses a restricted primitive`]
      : [];
    return [...current, ...findUnsafeMetadata(child, childPath)];
  });
}

export function validateCustomFieldDraft(field: CustomFieldDraft): ValidationResult {
  const errors = [...validateLocalizedLabels(field.labels).errors];

  if (!stableKeyPattern.test(field.key)) {
    errors.push("key must be a stable snake_case identifier");
  }

  if (!customFieldEntities.includes(field.entity)) {
    errors.push("entity is not configurable in V1");
  }

  if (!customFieldTypes.includes(field.type)) {
    errors.push("field type is not supported");
  }

  if (["dropdown", "multi_select"].includes(field.type)) {
    const options = field.options?.map((option) => option.trim()).filter(Boolean) ?? [];
    if (options.length < 2) {
      errors.push("selection fields require at least two options");
    }
    if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== options.length) {
      errors.push("selection options must be unique");
    }
  }

  if (field.type === "entity_reference" && !field.relationTarget) {
    errors.push("entity references require an approved relation target");
  }

  if (field.relationTarget && !customFieldEntities.includes(field.relationTarget)) {
    errors.push("relation target is not approved");
  }

  for (const rule of field.visibilityRules ?? []) {
    if (!stableKeyPattern.test(rule.fieldKey)) {
      errors.push(`visibility rule field ${rule.fieldKey} is invalid`);
    }
  }

  errors.push(...findUnsafeMetadata(field.validation));
  return result(errors);
}

export function validateTerminology(entries: readonly TerminologyEntry[]): ValidationResult {
  const errors: string[] = [];
  const conceptKeys = new Set<string>();
  const labelsByLocale = new Map<string, string>();

  for (const entry of entries) {
    if (!stableKeyPattern.test(entry.conceptKey)) {
      errors.push(`concept key ${entry.conceptKey} is invalid`);
    }
    if (conceptKeys.has(entry.conceptKey)) {
      errors.push(`concept key ${entry.conceptKey} is duplicated`);
    }
    conceptKeys.add(entry.conceptKey);

    errors.push(...validateLocalizedLabels(entry.singular, `${entry.conceptKey}.singular`).errors);
    errors.push(...validateLocalizedLabels(entry.plural, `${entry.conceptKey}.plural`).errors);

    for (const locale of configurationLocales) {
      for (const [form, label] of [["singular", entry.singular[locale]], ["plural", entry.plural[locale]]] as const) {
        const normalized = label.trim().toLocaleLowerCase(locale);
        const lookupKey = `${locale}:${normalized}`;
        const existing = labelsByLocale.get(lookupKey);
        if (existing && existing !== entry.conceptKey) {
          errors.push(`${locale} label ${form} conflicts between ${existing} and ${entry.conceptKey}`);
        }
        labelsByLocale.set(lookupKey, entry.conceptKey);
      }
    }
  }

  return result(errors);
}

export function validateStatusMachine(
  nodes: readonly StatusNode[],
  transitions: readonly StatusTransition[],
  startKey: string
): ValidationResult {
  const errors: string[] = [];
  const nodeMap = new Map(nodes.map((node) => [node.key, node]));
  const outgoing = new Map<string, string[]>();
  const transitionKeys = new Set<string>();

  if (!nodeMap.has(startKey)) {
    errors.push("start status does not exist");
  }

  for (const node of nodes) {
    if (!stableKeyPattern.test(node.key)) {
      errors.push(`status key ${node.key} is invalid`);
    }
    errors.push(...validateLocalizedLabels(node.labels, `status.${node.key}.labels`).errors);
  }

  for (const transition of transitions) {
    if (!nodeMap.has(transition.from) || !nodeMap.has(transition.to)) {
      errors.push(`transition ${transition.from} -> ${transition.to} references an unknown status`);
      continue;
    }
    if (transition.from === transition.to) {
      errors.push(`transition ${transition.from} cannot target itself`);
    }
    if (!permissionPattern.test(transition.permission)) {
      errors.push(`transition ${transition.from} -> ${transition.to} has an invalid permission`);
    }
    if (nodeMap.get(transition.from)?.terminal) {
      errors.push(`terminal status ${transition.from} cannot have outgoing transitions`);
    }

    const edge = `${transition.from}:${transition.to}`;
    if (transitionKeys.has(edge)) {
      errors.push(`transition ${transition.from} -> ${transition.to} is duplicated`);
    }
    transitionKeys.add(edge);
    outgoing.set(transition.from, [...(outgoing.get(transition.from) ?? []), transition.to]);
  }

  const visited = new Set<string>();
  const active = new Set<string>();
  let cycleFound = false;

  const walk = (key: string) => {
    if (active.has(key)) {
      cycleFound = true;
      return;
    }
    if (visited.has(key)) return;
    visited.add(key);
    active.add(key);
    for (const next of outgoing.get(key) ?? []) walk(next);
    active.delete(key);
  };

  if (nodeMap.has(startKey)) walk(startKey);
  if (cycleFound) errors.push("status transitions contain a cycle");

  for (const key of nodeMap.keys()) {
    if (!visited.has(key)) errors.push(`status ${key} is unreachable`);
  }

  return result(errors);
}

export function validateGradeScale(
  bands: readonly GradeBand[],
  minimum = 0,
  maximum = 100
): ValidationResult {
  const errors: string[] = [];
  const sorted = [...bands].sort((a, b) => a.minimum - b.minimum);

  if (sorted.length === 0) return result(["grade scale needs at least one band"]);

  for (const band of sorted) {
    errors.push(...validateLocalizedLabels(band.label, `grade.${band.key}.label`).errors);
    if (!stableKeyPattern.test(band.key)) errors.push(`grade key ${band.key} is invalid`);
    if (band.maximum <= band.minimum) errors.push(`grade ${band.key} has an invalid range`);
    if (band.gradePoint !== undefined && band.gradePoint < 0) {
      errors.push(`grade ${band.key} has a negative grade point`);
    }
  }

  if (sorted[0]?.minimum !== minimum) errors.push(`grade scale must start at ${minimum}`);
  if (sorted.at(-1)?.maximum !== maximum) errors.push(`grade scale must end at ${maximum}`);

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (previous.maximum !== current.minimum) {
      errors.push(`grade ranges ${previous.key} and ${current.key} overlap or leave a gap`);
    }
  }

  return result(errors);
}

export function renderNumberPreview(sequence: NumberSequenceDraft): { preview?: string; validation: ValidationResult } {
  const errors: string[] = [];
  const tokens = [...sequence.pattern.matchAll(/\{([A-Z_]+)\}/g)].map((match) => match[1]);

  if (!tokens.includes("COUNTER")) errors.push("number pattern must include {COUNTER}");
  for (const token of tokens) {
    if (!allowedNumberTokens.has(token)) errors.push(`number token {${token}} is not supported`);
  }
  if (sequence.padding < 1 || sequence.padding > 12) errors.push("padding must be between 1 and 12");
  if (!Number.isSafeInteger(sequence.nextValue) || sequence.nextValue < 1) {
    errors.push("next value must be a positive safe integer");
  }

  const validation = result(errors);
  if (!validation.valid) return { validation };

  const values: Record<string, string> = {
    BRANCH: sequence.branch,
    SESSION: sequence.session,
    YEAR: sequence.year,
    TYPE: sequence.type,
    COUNTER: String(sequence.nextValue).padStart(sequence.padding, "0")
  };

  return {
    preview: sequence.pattern.replace(/\{([A-Z_]+)\}/g, (_, token: string) => values[token] ?? ""),
    validation
  };
}

export function assessConfigurationReadiness(modules: readonly ConfigurationModuleState[]) {
  const missing = modules.filter((module) => !module.complete);
  const blockers = missing.flatMap((module) => module.blockers ?? [`${module.key} is incomplete`]);
  const percent = modules.length === 0
    ? 0
    : Math.round(((modules.length - missing.length) / modules.length) * 100);

  return {
    ready: missing.length === 0,
    percent,
    missing: missing.map((module) => module.key),
    blockers
  } as const;
}

export function publishedKeyChangeAllowed(oldKey: string, nextKey: string, published: boolean): boolean {
  return !published || oldKey === nextKey;
}

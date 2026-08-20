export type ConfigurationScope = "tenant" | "branch" | "program" | "session";

export type PublishedConfigurationValue<T> = {
  scope: ConfigurationScope;
  scopeKey: string;
  value: T;
  effectiveAt: string;
  endsAt?: string;
  version: number;
};

export type ConfigurationResolutionContext = {
  tenant: string;
  branch?: string;
  program?: string;
  session?: string;
};

export type ResolvedConfigurationValue<T> = {
  value: T;
  source: "platform" | "preset" | ConfigurationScope;
  version?: number;
};

const scopePriority: Record<ConfigurationScope, number> = {
  tenant: 1,
  branch: 2,
  program: 3,
  session: 4
};

function matchesContext(
  candidate: PublishedConfigurationValue<unknown>,
  context: ConfigurationResolutionContext
): boolean {
  return context[candidate.scope] === candidate.scopeKey;
}

export function resolveConfigurationValue<T>({
  platformDefault,
  presetValue,
  values,
  context,
  at = new Date()
}: {
  platformDefault: T;
  presetValue?: T;
  values: readonly PublishedConfigurationValue<T>[];
  context: ConfigurationResolutionContext;
  at?: Date;
}): ResolvedConfigurationValue<T> {
  const timestamp = at.getTime();
  const applicable = values
    .filter((candidate) => {
      const starts = new Date(candidate.effectiveAt).getTime();
      const ends = candidate.endsAt ? new Date(candidate.endsAt).getTime() : Number.POSITIVE_INFINITY;
      return matchesContext(candidate, context) && starts <= timestamp && ends > timestamp;
    })
    .sort((left, right) => {
      const priority = scopePriority[right.scope] - scopePriority[left.scope];
      if (priority !== 0) return priority;

      const effective = new Date(right.effectiveAt).getTime() - new Date(left.effectiveAt).getTime();
      return effective !== 0 ? effective : right.version - left.version;
    });

  const selected = applicable[0];
  if (selected) {
    return { value: selected.value, source: selected.scope, version: selected.version };
  }

  if (presetValue !== undefined) {
    return { value: presetValue, source: "preset" };
  }

  return { value: platformDefault, source: "platform" };
}

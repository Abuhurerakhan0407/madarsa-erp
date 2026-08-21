export type ConfigurationState = "complete" | "attention" | "pending";

export type VersionedState = {
  state?: string | null;
  status?: string | null;
};

export function versionedConfigurationState(
  rows: readonly VersionedState[],
  publishedValues: readonly string[] = ["published"]
): ConfigurationState {
  if (
    rows.some((row) => {
      const value = row.state ?? row.status ?? null;
      return value !== null && publishedValues.includes(value);
    })
  ) {
    return "complete";
  }

  return rows.length > 0 ? "attention" : "pending";
}

export function readinessPercent(states: readonly ConfigurationState[]): number {
  if (states.length === 0) return 0;
  const score = states.reduce((total, state) => {
    if (state === "complete") return total + 1;
    if (state === "attention") return total + 0.5;
    return total;
  }, 0);

  return Math.round((score / states.length) * 100);
}

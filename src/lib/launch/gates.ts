export type LaunchGate = { key: string; owner: string; required: boolean; complete: boolean };

export function evaluateLaunch(gates: readonly LaunchGate[]) {
  const blocking = gates.filter((gate) => gate.required && !gate.complete);
  const required = gates.filter((gate) => gate.required);
  return {
    ready: blocking.length === 0,
    percent: required.length === 0 ? 100 : Math.round(((required.length - blocking.length) / required.length) * 100),
    blocking: blocking.map((gate) => ({ key: gate.key, owner: gate.owner }))
  };
}

export function updateGate(gates: readonly LaunchGate[], key: string, complete: boolean): LaunchGate[] {
  if (!gates.some((gate) => gate.key === key)) throw new Error(`unknown_launch_gate:${key}`);
  return gates.map((gate) => gate.key === key ? { ...gate, complete } : gate);
}

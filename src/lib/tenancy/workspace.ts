export function selectWorkspaceBranchId(
  primaryBranchId: number | null,
  allBranches: boolean,
  scopedBranchIds: readonly number[]
): number | null {
  return allBranches ? primaryBranchId : scopedBranchIds[0] ?? null;
}

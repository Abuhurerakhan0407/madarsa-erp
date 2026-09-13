export function selectWorkspaceBranchId(
  primaryBranchId: number | null,
  allBranches: boolean,
  scopedBranchIds: readonly number[],
  preferredBranchId?: number | null
): number | null {
  if (preferredBranchId && (allBranches || scopedBranchIds.includes(preferredBranchId))) return preferredBranchId;
  if (allBranches) return primaryBranchId;
  return scopedBranchIds[0] ?? null;
}

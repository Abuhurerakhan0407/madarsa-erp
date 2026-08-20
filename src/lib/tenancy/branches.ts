export type Branch = {
  id: string;
  tenantId: string;
  name: string;
  status: "active" | "inactive";
};

export type TenantBranches = {
  tenantId: string;
  primaryBranchId: string;
  branches: readonly Branch[];
};

export function validateTenantBranches(value: TenantBranches): boolean {
  const matchingBranches = value.branches.filter(
    (branch) => branch.tenantId === value.tenantId && branch.id === value.primaryBranchId
  );

  return matchingBranches.length === 1 && matchingBranches[0]?.status === "active";
}

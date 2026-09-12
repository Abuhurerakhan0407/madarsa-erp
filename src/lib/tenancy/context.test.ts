import {readFileSync} from 'node:fs';
import { describe, expect, it } from "vitest";
import { selectWorkspaceBranchId } from "./workspace";

const selectionRoute=readFileSync('src/app/api/workspace/select/route.ts','utf8');
const contextSource=readFileSync('src/lib/tenancy/context.ts','utf8');

describe("workspace branch selection", () => {
  it("uses the tenant primary branch for all-branch memberships by default", () => {
    expect(selectWorkspaceBranchId(1, true, [2])).toBe(1);
  });
  it("honors an explicit authorized branch", () => {
    expect(selectWorkspaceBranchId(1, true, [2],3)).toBe(3);
    expect(selectWorkspaceBranchId(1, false, [2,3],3)).toBe(3);
  });
  it("uses only an authorized scope and ignores stale scoped selections", () => {
    expect(selectWorkspaceBranchId(1, false, [2])).toBe(2);
    expect(selectWorkspaceBranchId(1, false, [2],99)).toBe(2);
  });
  it("fails closed when a scoped membership has no branch", () => {
    expect(selectWorkspaceBranchId(1, false, [])).toBeNull();
  });
  it("server-validates membership, branch scope and stores only an HTTP-only workspace cookie",()=>{
    expect(selectionRoute).toContain('.eq("identity_id",identity.id)');
    expect(selectionRoute).toContain('membership_branch_scopes');
    expect(selectionRoute).toContain('.eq("branch_id",branchId)');
    expect(selectionRoute).toContain('httpOnly:true');
    expect(contextSource).toContain('parseWorkspaceSelection');
    expect(contextSource).toContain('memberships.find(row=>row.id===preferred?.membershipId)??memberships[0]');
  });
});

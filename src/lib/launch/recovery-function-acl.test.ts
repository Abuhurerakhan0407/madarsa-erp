import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const aclContract = readFileSync(
  new URL("../../../database/contracts/function_execution_acl.sql", import.meta.url),
  "utf8"
);
const scopeSmoke = readFileSync(
  new URL("../../../scripts/recovery-scope-smoke.sh", import.meta.url),
  "utf8"
);

describe("recovery function execution ACL contract", () => {
  it("revokes default/public browser execution before restoring reviewed grants", () => {
    expect(aclContract).toContain("from public, anon, authenticated, service_role");
    expect(aclContract).toContain("where n.nspname in ('public', 'private')");
    expect(aclContract).toContain("where n.nspname = 'public'");
    expect(aclContract).toContain("to service_role");
  });

  it("keeps the authenticated private-helper allowlist explicit", () => {
    for (const signature of [
      "private.has_any_tenant_membership()",
      "private.has_permission(bigint, text, bigint)",
      "private.has_relationship(bigint, text, text)",
      "private.has_tenant_membership(bigint)",
      "private.storage_tenant_id(text)"
    ]) {
      expect(aclContract).toContain(`grant execute on function ${signature} to authenticated`);
    }
  });

  it("keeps the service-role private-helper allowlist explicit", () => {
    for (const signature of [
      "private.admission_transition_allowed(text, text)",
      "private.convert_admission(bigint, bigint, text, text, bigint)",
      "private.enforce_admission_transition()",
      "private.reserve_formatted_number(bigint, text, bigint, bigint, date)",
      "private.reserve_number_sequence_for_period(bigint, text, bigint, bigint, date)",
      "private.reserve_number_sequence(bigint, text, bigint)",
      "private.resolve_staff_membership(uuid, bigint, bigint, text[])"
    ]) {
      expect(aclContract).toContain(`grant execute on function ${signature} to service_role`);
    }
  });

  it("compares the complete restored matrix to production and fails closed on broad access", () => {
    expect(scopeSmoke).toContain("FUNCTION_ACL_CONTRACT");
    expect(scopeSmoke).toContain("FUNCTION_ACL_SQL");
    expect(scopeSmoke).toContain("SOURCE_FUNCTION_ACL_CANON");
    expect(scopeSmoke).toContain("RESTORED_FUNCTION_ACL_CANON");
    expect(scopeSmoke).toContain("Restored application function execution ACL matrix does not match production");
    expect(scopeSmoke).toContain("public_execute == true or .anon_execute == true");
    expect(scopeSmoke).toContain(".restore.function_acl_matrix_verified = true");
  });
});

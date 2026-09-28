import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260928100500_portal_push_deliveries_deny_client_policy.sql"),
  "utf8",
);

describe("portal push delivery RLS", () => {
  it("keeps direct client access explicitly denied", () => {
    expect(migration).toContain("create policy portal_push_deliveries_deny_clients");
    expect(migration).toContain("as restrictive");
    expect(migration).toContain("to anon, authenticated");
    expect(migration).toContain("using (false)");
    expect(migration).toContain("with check (false)");
  });
});

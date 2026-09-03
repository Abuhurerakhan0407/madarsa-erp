import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
const migrations = migrationFiles.map((name) => ({
  name,
  sql: readFileSync(join(migrationsDir, name), "utf8")
}));

function count(pattern: RegExp, value: string): number {
  return [...value.matchAll(pattern)].length;
}

describe("database migration security surface", () => {
  it("never grants function execution directly to browser roles", () => {
    for (const migration of migrations) {
      const statements = migration.sql.split(";");
      const unsafe = statements.filter((statement) =>
        /grant\s+execute\s+on\s+function\b[\s\S]*?\bto\s+(?:public|anon|authenticated)\b/i.test(statement)
      );
      expect(unsafe, migration.name).toEqual([]);
    }
  });

  it("hardens SECURITY DEFINER functions and exposes only public entrypoints to service_role", () => {
    for (const migration of migrations) {
      const definerCount = count(/security\s+definer/gi, migration.sql);
      if (definerCount === 0) continue;

      const publicDefinerCount = count(
        /create\s+or\s+replace\s+function\s+public\.[\s\S]*?security\s+definer/gi,
        migration.sql
      );
      // PostgreSQL accepts both `SET search_path = ...` and `SET search_path TO ...`.
      // Treat either explicit form as a hardened per-function search_path declaration.
      const searchPathCount = count(/set\s+search_path\s*(?:=|\bto\b)/gi, migration.sql);
      const browserRevokeCount = count(
        /revoke\s+all\s+on\s+function\b[\s\S]*?\bfrom\s+public\s*,\s*anon\s*,\s*authenticated/gi,
        migration.sql
      );
      const serviceRoleGrantCount = count(
        /grant\s+execute\s+on\s+function\s+public\.[\s\S]*?\bto\s+service_role/gi,
        migration.sql
      );
      const privateServiceRoleGrants = migration.sql.split(";").filter((statement) =>
        /grant\s+execute\s+on\s+function\s+private\./i.test(statement)
      );

      expect(searchPathCount, `${migration.name}: search_path`).toBeGreaterThanOrEqual(definerCount);
      expect(browserRevokeCount, `${migration.name}: browser revoke`).toBeGreaterThanOrEqual(definerCount);
      expect(serviceRoleGrantCount, `${migration.name}: public service_role grant`).toBeGreaterThanOrEqual(publicDefinerCount);
      expect(privateServiceRoleGrants, `${migration.name}: private functions stay internal`).toEqual([]);
    }
  });

  it("does not authorize from user-editable raw metadata", () => {
    for (const migration of migrations) {
      expect(migration.sql.toLowerCase(), migration.name).not.toContain("raw_user_meta_data");
    }
  });
});

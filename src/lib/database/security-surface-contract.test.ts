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

  it("hardens every SECURITY DEFINER migration with search_path, browser-role revoke, and service-role execution", () => {
    for (const migration of migrations) {
      const definerCount = count(/security\s+definer/gi, migration.sql);
      if (definerCount === 0) continue;

      const searchPathCount = count(/set\s+search_path\s*=/gi, migration.sql);
      const browserRevokeCount = count(
        /revoke\s+all\s+on\s+function\b[\s\S]*?\bfrom\s+public\s*,\s*anon\s*,\s*authenticated/gi,
        migration.sql
      );
      const serviceRoleGrantCount = count(
        /grant\s+execute\s+on\s+function\b[\s\S]*?\bto\s+service_role/gi,
        migration.sql
      );

      expect(searchPathCount, `${migration.name}: search_path`).toBeGreaterThanOrEqual(definerCount);
      expect(browserRevokeCount, `${migration.name}: browser revoke`).toBeGreaterThanOrEqual(definerCount);
      expect(serviceRoleGrantCount, `${migration.name}: service_role grant`).toBeGreaterThanOrEqual(definerCount);
    }
  });

  it("does not authorize from user-editable raw metadata", () => {
    for (const migration of migrations) {
      expect(migration.sql.toLowerCase(), migration.name).not.toContain("raw_user_meta_data");
    }
  });
});

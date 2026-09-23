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

function stripSqlComments(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ");
}

describe("database migration security surface", () => {
  it("never grants function execution directly to browser roles", () => {
    for (const migration of migrations) {
      const sql = stripSqlComments(migration.sql);
      const statements = sql.split(";");
      const unsafe = statements.filter((statement) =>
        /grant\s+execute\s+on\s+function\b[\s\S]*?\bto\s+(?:public|anon|authenticated)\b/i.test(statement)
      );
      expect(unsafe, migration.name).toEqual([]);
    }
  });

  it("hardens SECURITY DEFINER functions and exposes only public entrypoints to service_role", () => {
    for (const migration of migrations) {
      const sql = stripSqlComments(migration.sql);
      const definerCount = count(/security\s+definer/gi, sql);
      if (definerCount === 0) continue;

      const publicDefinerCount = count(
        /create\s+or\s+replace\s+function\s+public\.[\s\S]*?security\s+definer/gi,
        sql
      );
      // PostgreSQL accepts both `SET search_path = ...` and `SET search_path TO ...`.
      // Treat either explicit form as a hardened per-function search_path declaration.
      const searchPathCount = count(/set\s+search_path\s*(?:=|\bto\b)/gi, sql);
      const browserRevokeCount = count(
        /revoke\s+all\s+on\s+function\b[\s\S]*?\bfrom\s+public\s*,\s*anon\s*,\s*authenticated/gi,
        sql
      );
      const serviceRoleGrantCount = count(
        /grant\s+execute\s+on\s+function\s+public\.[\s\S]*?\bto\s+service_role/gi,
        sql
      );
      const privateServiceRoleGrants = sql.split(";").filter((statement) =>
        /grant\s+execute\s+on\s+function\s+private\./i.test(statement)
      );

      expect(searchPathCount, `${migration.name}: search_path`).toBeGreaterThanOrEqual(definerCount);
      // Public SECURITY DEFINER entrypoints must revoke browser execution in the defining migration.
      // Private helper ACLs may be tightened by an append-only follow-up migration and are covered
      // by phase-specific contracts; they must never be granted directly to service_role here.
      expect(browserRevokeCount, `${migration.name}: browser revoke`).toBeGreaterThanOrEqual(publicDefinerCount);
      expect(serviceRoleGrantCount, `${migration.name}: public service_role grant`).toBeGreaterThanOrEqual(publicDefinerCount);
      expect(privateServiceRoleGrants, `${migration.name}: private functions stay internal`).toEqual([]);
    }
  });

  it("does not authorize from user-editable raw metadata", () => {
    for (const migration of migrations) {
      const sql = stripSqlComments(migration.sql);
      expect(sql.toLowerCase(), migration.name).not.toContain("raw_user_meta_data");
    }
  });
});

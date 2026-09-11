import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
const migrations = migrationFiles.map((name) => ({
  name,
  sql: readFileSync(join(migrationsDir, name), "utf8")
}));
const allSql = migrations.map(({sql}) => sql).join("\n");

const privateRlsHelpers = new Set([
  "person_branch_read_allowed_v1",
  "student_profile_branch_read_allowed_v1",
  "attendance_record_branch_read_allowed_v1",
  "mark_entry_branch_read_allowed_v1",
  "identity_assigned_teacher_for_student_v1",
  "attendance_record_scoped_read_allowed_v2",
  "mark_entry_scoped_read_allowed_v2"
]);

function count(pattern: RegExp, value: string): number {
  return [...value.matchAll(pattern)].length;
}

function escapeRegex(value:string):string {
  return value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
}

function publicSecurityDefinerNames(sql:string):string[]{
  const starts=[...sql.matchAll(/create\s+or\s+replace\s+function\s+public\.([a-z0-9_]+)\s*\(/gi)];
  const names:string[]=[];
  for(let index=0;index<starts.length;index+=1){
    const start=starts[index];
    const from=start.index??0;
    const to=index+1<starts.length?(starts[index+1].index??sql.length):sql.length;
    const block=sql.slice(from,to);
    if(/security\s+definer/i.test(block))names.push(start[1].toLowerCase());
  }
  return names;
}

describe("database migration security surface", () => {
  it("never grants public RPC execution directly to browser roles", () => {
    for (const migration of migrations) {
      const statements = migration.sql.split(";");
      const unsafe = statements.filter((statement) =>
        /grant\s+execute\s+on\s+function\s+public\.[\s\S]*?\bto\s+(?:public|anon|authenticated)\b/i.test(statement)
      );
      expect(unsafe, migration.name).toEqual([]);
    }
  });

  it("permits authenticated execution only for the explicit private RLS-helper allowlist", () => {
    for (const migration of migrations) {
      for (const statement of migration.sql.split(";")) {
        const match=statement.match(/grant\s+execute\s+on\s+function\s+private\.([a-z0-9_]+)\([^;]*?\)\s+to\s+([^;]+)/i);
        if(!match)continue;
        const functionName=match[1].toLowerCase();
        const grantees=match[2].toLowerCase().split(",").map(value=>value.trim());
        expect(privateRlsHelpers.has(functionName), `${migration.name}: private helper allowlist`).toBe(true);
        for(const grantee of grantees){
          expect(["authenticated","service_role"], `${migration.name}: private helper grantee`).toContain(grantee);
        }
      }
    }
    const aclMigration=readFileSync(join(migrationsDir,"20260912013000_master_audit_rls_helper_acl.sql"),"utf8").toLowerCase();
    for(const functionName of privateRlsHelpers){
      expect(aclMigration, `${functionName}: final revoke`).toContain(`revoke all on function private.${functionName}`);
      expect(aclMigration, `${functionName}: authenticated only`).toMatch(new RegExp(`grant\\s+execute\\s+on\\s+function\\s+private\\.${escapeRegex(functionName)}\\([^;]+\\)\\s+to\\s+authenticated`,"i"));
    }
    expect(aclMigration).not.toMatch(/grant\s+execute\s+on\s+function\s+private\.[^;]+\bto\s+service_role/i);
  });

  it("hardens SECURITY DEFINER functions and exposes public entrypoints only to service_role", () => {
    for (const migration of migrations) {
      const definerCount = count(/security\s+definer/gi, migration.sql);
      if (definerCount === 0) continue;
      const searchPathCount = count(/set\s+search_path\s*(?:=|\bto\b)/gi, migration.sql);
      expect(searchPathCount, `${migration.name}: search_path`).toBeGreaterThanOrEqual(definerCount);
      for(const functionName of publicSecurityDefinerNames(migration.sql)){
        const escaped=escapeRegex(functionName);
        expect(allSql, `${functionName}: browser revoke`).toMatch(new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${escaped}\\([^;]+\\)\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated`,"i"));
        expect(allSql, `${functionName}: service role grant`).toMatch(new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${escaped}\\([^;]+\\)\\s+to\\s+service_role`,"i"));
      }
    }
  });

  it("does not authorize from user-editable raw metadata", () => {
    for (const migration of migrations) {
      expect(migration.sql.toLowerCase(), migration.name).not.toContain("raw_user_meta_data");
    }
  });
});

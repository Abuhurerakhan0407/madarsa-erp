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

const privateAuthenticatedRlsHelpers = new Set([
  "person_branch_read_allowed_v1",
  "student_profile_branch_read_allowed_v1",
  "attendance_record_branch_read_allowed_v1",
  "mark_entry_branch_read_allowed_v1",
  "identity_assigned_teacher_for_student_v1",
  "attendance_record_scoped_read_allowed_v2",
  "mark_entry_scoped_read_allowed_v2"
]);

function escapeRegex(value:string):string {
  return value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
}

type FunctionBlock={schema:string;name:string;sql:string};
function functionBlocks(sql:string):FunctionBlock[]{
  const starts=[...sql.matchAll(/create\s+or\s+replace\s+function\s+([a-z0-9_]+)\.([a-z0-9_]+)\s*\(/gi)];
  return starts.map((start,index)=>({
    schema:start[1].toLowerCase(),
    name:start[2].toLowerCase(),
    sql:sql.slice(start.index??0,index+1<starts.length?(starts[index+1].index??sql.length):sql.length)
  }));
}

describe("database migration security surface", () => {
  it("never grants public RPC execution directly to browser roles", () => {
    for (const migration of migrations) {
      const unsafe = migration.sql.split(";").filter((statement) =>
        /grant\s+execute\s+on\s+function\s+public\.[\s\S]*?\bto\s+(?:public|anon|authenticated)\b/i.test(statement)
      );
      expect(unsafe, migration.name).toEqual([]);
    }
  });

  it("allows authenticated private-function execution only for explicit RLS helpers", () => {
    for (const migration of migrations) {
      for (const statement of migration.sql.split(";")) {
        const match=statement.match(/grant\s+execute\s+on\s+function\s+private\.([a-z0-9_]+)\([^;]*?\)\s+to\s+([^;]+)/i);
        if(!match)continue;
        const functionName=match[1].toLowerCase();
        const grantees=match[2].toLowerCase().split(",").map(value=>value.trim());
        if(grantees.includes("authenticated")){
          expect(privateAuthenticatedRlsHelpers.has(functionName), `${migration.name}: authenticated private helper allowlist`).toBe(true);
        }
        expect(grantees, `${migration.name}: private helper must never be anon/public`).not.toContain("anon");
        expect(grantees, `${migration.name}: private helper must never be anon/public`).not.toContain("public");
      }
    }

    const aclMigration=readFileSync(join(migrationsDir,"20260912013000_master_audit_rls_helper_acl.sql"),"utf8").toLowerCase();
    for(const functionName of privateAuthenticatedRlsHelpers){
      expect(aclMigration, `${functionName}: final revoke`).toContain(`revoke all on function private.${functionName}`);
      expect(aclMigration, `${functionName}: authenticated RLS execution`).toMatch(new RegExp(`grant\\s+execute\\s+on\\s+function\\s+private\\.${escapeRegex(functionName)}\\([^;]+\\)\\s+to\\s+authenticated`,"i"));
    }
    expect(aclMigration).not.toMatch(/grant\s+execute\s+on\s+function\s+private\.[^;]+\bto\s+service_role/i);
  });

  it("hardens actual SECURITY DEFINER functions and exposes public entrypoints only to service_role", () => {
    for (const migration of migrations) {
      for(const fn of functionBlocks(migration.sql)){
        if(!/security\s+definer/i.test(fn.sql))continue;
        expect(fn.sql, `${migration.name}: ${fn.schema}.${fn.name} search_path`).toMatch(/set\s+search_path\s*(?:=|\bto\b)/i);
        if(fn.schema!=="public")continue;
        const escaped=escapeRegex(fn.name);
        expect(allSql, `${fn.name}: browser revoke`).toMatch(new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${escaped}\\([^;]+\\)\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated`,"i"));
        expect(allSql, `${fn.name}: service role grant`).toMatch(new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${escaped}\\([^;]+\\)\\s+to\\s+service_role`,"i"));
      }
    }
  });

  it("does not authorize from user-editable raw metadata", () => {
    for (const migration of migrations) {
      expect(migration.sql.toLowerCase(), migration.name).not.toContain("raw_user_meta_data");
    }
  });
});

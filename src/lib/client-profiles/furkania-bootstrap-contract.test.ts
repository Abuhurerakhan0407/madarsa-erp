import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";
const read=(path:string)=>readFileSync(resolve(process.cwd(),path),"utf8");
const migration=read("supabase/migrations/20260912033000_furkania_atomic_academic_bootstrap.sql");
const route=read("src/app/api/client/furkania/bootstrap/route.ts");

describe("Furkania governed academic bootstrap",()=>{
 it("runs the complete bootstrap through one transactional RPC",()=>{expect(route).toContain('admin.rpc("bootstrap_furkania_deeniyat_v1"');expect(route).not.toContain('admin.rpc("create_teaching_program_v1"');expect(route).not.toContain('admin.rpc("add_program_level_v1"');expect(route).not.toContain('admin.rpc("add_curriculum_component_v1"');expect(migration).toContain("pg_advisory_xact_lock")});
 it("authorizes before idempotent/no-op work and hard-locks the tenant",()=>{expect(migration.indexOf("resolve_staff_membership")).toBeLessThan(migration.indexOf("pg_advisory_xact_lock"));expect(migration).toContain("t.slug='madrasa-e-furkania'");expect(route).toContain('FURKANIA_TENANT_SLUG="madrasa-e-furkania"')});
 it("reactivates existing courses deterministically instead of failing on inactive duplicates",()=>{expect(migration).toContain("v_levels_reactivated");expect(migration).toContain("status='active',updated_at=now()");expect(migration).toContain("course_5")});
 it("persists Hinglish and age 4-5 Course 1 as governed structured metadata",()=>{expect(route).toContain('book_medium:"hinglish"');expect(route).toContain('default_level_key:"course_1"');expect(migration).toContain("add column if not exists metadata jsonb");expect(migration).toContain("entry_rules=coalesce(entry_rules,'{}'::jsonb)||p_entry_rules");expect(migration).toContain("metadata=coalesce(metadata,'{}'::jsonb)||p_metadata")});
 it("inherits curriculum metadata into future draft clones",()=>{expect(migration).toContain("inherit_curriculum_metadata_v1");expect(migration).toContain("cv.state='published'");expect(migration).toContain("new.metadata:=coalesce(v_metadata,'{}'::jsonb)")});
 it("keeps the client RPC server-only and timetable blocked",()=>{expect(migration).toMatch(/revoke all on function public\.bootstrap_furkania_deeniyat_v1[\s\S]*from public,anon,authenticated/i);expect(migration).toMatch(/grant execute on function public\.bootstrap_furkania_deeniyat_v1[\s\S]*to service_role/i);expect(route).toContain('timetableCreated:false');expect(route).toContain('blocked_until_exact_shift_times_are_confirmed')});
});

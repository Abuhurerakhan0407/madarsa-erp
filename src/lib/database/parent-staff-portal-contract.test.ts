import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe,expect,it } from "vitest";

const runtime=readFileSync(resolve(process.cwd(),"supabase/migrations/20260831070000_parent_staff_portal_runtime.sql"),"utf8").toLowerCase();
const hardening=readFileSync(resolve(process.cwd(),"supabase/migrations/20260831070500_parent_staff_portal_hardening.sql"),"utf8").toLowerCase();
const sql=`${runtime}\n${hardening}`;

describe("parent and staff portal database contract",()=>{
 it("stores only hashed one-time portal access tokens",()=>{expect(runtime).toContain("token_digest text not null");expect(runtime).toContain("token_digest ~ '^[a-f0-9]{64}$'");expect(runtime).not.toContain("token_plain");});
 it("keeps portal access storage server-only",()=>{expect(runtime).toContain("alter table public.portal_access_codes enable row level security");expect(runtime).toContain("revoke all on public.portal_access_codes from public,anon,authenticated");expect(runtime).toContain("grant all on public.portal_access_codes to service_role");});
 it("requires an active portal administrator role",()=>{expect(runtime).toContain("join public.roles r");expect(runtime).toContain("r.status='active'");expect(runtime).toContain("portal.notice.manage");});
 it("only issues guardian codes for verified portal-visible relationships in the branch",()=>{expect(runtime).toContain("pr.status='verified'");expect(runtime).toContain("pr.portal_visibility in('limited','standard')");expect(runtime).toContain("e.branch_id=p_branch_id");});
 it("only issues employee codes for active employment in the branch",()=>{expect(runtime).toContain("public.hr_employments");expect(runtime).toContain("he.branch_id=p_branch_id");expect(runtime).toContain("he.state in('active','on_leave')");});
 it("claims access without creating a staff membership",()=>{expect(runtime).toContain("insert into public.identity_person_links");expect(runtime).toContain("authenticated identity not found");expect(runtime).not.toContain("insert into public.memberships");});
 it("never exposes private Quran notes through the portal",()=>{expect(sql).toContain("parent_visible_remark");expect(sql).not.toContain("private_note");});
 it("hardens notices to branches reachable by the linked guardian or employee",()=>{expect(hardening).toContain("e.branch_id=n.branch_id");expect(hardening).toContain("he.branch_id=n.branch_id");expect(hardening).toContain("n.branch_id is null");});
 it("keeps every portal rpc service-role only",()=>{expect(sql).toContain("revoke all on function public.claim_portal_access_code_v1");expect(sql).toContain("revoke all on function public.get_portal_home_v1");expect(sql).toContain("to service_role");expect(sql).not.toContain("to authenticated;");});
});

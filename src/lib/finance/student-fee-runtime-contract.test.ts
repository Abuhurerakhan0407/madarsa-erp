import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";
const read=(path:string)=>readFileSync(resolve(process.cwd(),path),"utf8");
const runtime=read("supabase/migrations/20260912024500_master_audit_student_fee_runtime.sql");
const options=read("supabase/migrations/20260912030000_master_audit_student_fee_charge_options.sql");
const api=read("src/app/api/fees/action/route.ts");
const ui=read("src/components/student-fees-workspace.tsx");

describe("student fee operational runtime",()=>{
 it("keeps fee mutations server-only and permission checked",()=>{for(const sql of [runtime,options]){expect(sql).toMatch(/revoke all on function[\s\S]*from public,anon,authenticated/i);expect(sql).toMatch(/grant execute on function[\s\S]*to service_role/i)}expect(runtime).toContain("finance.fees.manage");expect(runtime).toContain("finance.payment.collect");expect(runtime).toContain("finance.payment.reverse")});
 it("preserves append-only allocation reversal and receipt history",()=>{expect(runtime).toContain("payment_allocation_reversals_append_only");expect(runtime).toContain("private.reject_append_only_mutation()");expect(runtime).toContain("payment_receipts");expect(runtime).toContain("v_receipt.revision+1");expect(runtime).not.toMatch(/delete from public\.(payment_allocations|payment_receipts|payment_refunds)/i)});
 it("uses configured published structures instead of inventing Furkania fee amounts",()=>{expect(runtime).toContain("s.state='published'");expect(runtime).toContain("v_item.amount");expect(options).toContain("fee_structure_items");expect(options).toContain("state='published'");expect(runtime).not.toContain("Madrasa-e-Furkania");expect(runtime).not.toContain("madrasa-e-furkania")});
 it("makes charge and payment retries idempotent and rejects conflicting reuse",()=>{expect(runtime).toContain("c.idempotency_key=p_idempotency_key");expect(runtime).toContain("p.idempotency_key=p_idempotency_key");expect(runtime).toContain("request key conflicts");expect(runtime).toContain("payment_refunds_tenant_id_idempotency_key_uidx")});
 it("prevents overpayment and allocates oldest dues first",()=>{expect(runtime).toContain("payment cannot exceed outstanding charges");expect(runtime).toContain("order by c.due_date,c.charge_date,c.id");expect(runtime).toContain("oldest_due_first_v1");expect(runtime).toContain("payment allocation did not consume the full amount")});
 it("does not let an office operator self-verify Razorpay payments",()=>{expect(runtime).toContain("v_mode not in('cash','bank_transfer','cheque','upi','credit','sponsorship','custom')");expect(runtime).not.toContain("v_mode not in('cash','bank_transfer','cheque','upi','razorpay'")});
 it("uses stable payment-derived receipt numbers rather than max-plus-one numbering",()=>{expect(runtime).toContain("format('FEE-%s-%s',p_tenant_id,v_payment.id)");expect(runtime).not.toMatch(/max\s*\([^)]*receipt/i)});
 it("guards the web mutation surface before finance RPCs",()=>{expect(api).toContain("isSameOriginRequest(request)");expect(api).toContain("isJsonRequest(request)");expect(api).toContain("getVerifiedIdentity()");expect(api).toContain("getTenantContext()");expect(api).toContain("idempotencyKey")});
 it("ships a real fees workspace and labels missing client policy as configuration pending",()=>{expect(ui).toContain("Fees & payments");expect(ui).toContain("Post configured charge");expect(ui).toContain("Record payment & issue receipt");expect(ui).toContain("Reverse full payment");expect(ui).toContain("No published fee structure yet");expect(ui).not.toContain("demo/fees")});
});

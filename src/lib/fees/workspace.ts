import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => v && typeof v === "object" && !Array.isArray(v) ? v as Raw : {};
const arr = (v: unknown): Raw[] => Array.isArray(v) ? v.filter((x) => x && typeof x === "object" && !Array.isArray(x)) as Raw[] : [];
const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
const str = (v: unknown) => typeof v === "string" ? v : "";

export async function getMinimalFeesWorkspace() {
  const workspace = await getTenantContext();
  if (!workspace?.branchId) throw new Error("Active branch is required.");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_minimal_fees_workspace_v1", {
    p_identity_id: workspace.identityId,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId
  });
  if (error) throw new Error(error.message);
  const raw = obj(data);
  const summary = obj(raw.summary);
  return {
    summary: { assigned: num(summary.assigned), gross: num(summary.gross), concessions: num(summary.concessions), paid: num(summary.paid), outstanding: num(summary.outstanding) },
    items: arr(raw.items).map((x) => ({ id: num(x.id), name: str(x.name), amount: num(x.amount), frequency: str(x.frequency), state: str(x.state) })),
    students: arr(raw.students).map((x) => ({ personId: num(x.student_person_id), studentNumber: str(x.student_number), name: str(x.student_name), groupId: x.group_id == null ? null : num(x.group_id) })),
    groups: arr(raw.groups).map((x) => ({ id: num(x.id), labels: obj(x.labels) })),
    rows: arr(raw.rows).map((x) => ({
      id: num(x.id), feeItemId: num(x.fee_item_id), feeName: str(x.fee_name), studentPersonId: num(x.student_person_id), studentNumber: str(x.student_number), studentName: str(x.student_name), groupId: x.group_id == null ? null : num(x.group_id), groupLabels: obj(x.group_labels), gross: num(x.gross_amount), concession: num(x.concession_amount), paid: num(x.paid), outstanding: num(x.outstanding), dueDate: str(x.due_date), state: str(x.state),
      payments: arr(x.payments).map((p) => ({ id: num(p.id), amount: num(p.amount), paymentDate: str(p.payment_date), mode: str(p.mode), receiptNumber: str(p.receipt_number), note: str(p.note) }))
    }))
  };
}

export type MinimalFeesWorkspace = Awaited<ReturnType<typeof getMinimalFeesWorkspace>>;
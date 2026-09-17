import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";

type Raw = Record<string, unknown>;
const obj = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const text = (value: unknown): string => typeof value === "string" ? value : "";
const num = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;

export type PortalGuardianFeePayment = {
  id: number;
  amount: number;
  paymentDate: string;
  mode: string;
  receiptNumber: string;
  note: string;
};

export type PortalGuardianFeeRow = {
  assignmentId: number;
  studentPersonId: number;
  studentNumber: string;
  studentName: string;
  branchId: number;
  branchName: string;
  feeName: string;
  gross: number;
  concession: number;
  paid: number;
  outstanding: number;
  dueDate: string;
  state: string;
  payments: PortalGuardianFeePayment[];
};

export async function getPortalGuardianFees(tenantId: number): Promise<PortalGuardianFeeRow[]> {
  const identity = await getVerifiedIdentity();
  if (!identity || !Number.isInteger(tenantId) || tenantId <= 0) return [];

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_portal_guardian_fees_v1", {
    p_identity_id: identity.id,
    p_tenant_id: tenantId
  });
  if (error) throw new Error(`Unable to load portal fees: ${error.message}`);

  const root = obj(data);
  const source = Array.isArray(root.rows) ? root.rows : [];
  return source.flatMap((value) => {
    const row = obj(value);
    const assignmentId = num(row.assignment_id);
    const studentPersonId = num(row.student_person_id);
    const branchId = num(row.branch_id);
    if (!assignmentId || !studentPersonId || !branchId) return [];

    const payments = (Array.isArray(row.payments) ? row.payments : []).flatMap((value) => {
      const payment = obj(value);
      const id = num(payment.id);
      if (!id) return [];
      return [{
        id,
        amount: num(payment.amount),
        paymentDate: text(payment.payment_date),
        mode: text(payment.mode),
        receiptNumber: text(payment.receipt_number),
        note: text(payment.note)
      }];
    });

    return [{
      assignmentId,
      studentPersonId,
      studentNumber: text(row.student_number),
      studentName: text(row.student_name),
      branchId,
      branchName: text(row.branch_name),
      feeName: text(row.fee_name),
      gross: num(row.gross_amount),
      concession: num(row.concession_amount),
      paid: num(row.paid),
      outstanding: num(row.outstanding),
      dueDate: text(row.due_date),
      state: text(row.state),
      payments
    }];
  });
}

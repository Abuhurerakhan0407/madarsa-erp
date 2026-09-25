import { NextResponse } from "next/server";
import { disabledCapabilityResponse } from "@/lib/capabilities/server";
import { getMinimalFeesWorkspace } from "@/lib/fees/workspace";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

const asNumber = (value: unknown) =>
  Number.isFinite(Number(value)) ? Number(value) : null;
const asText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export async function GET() {
  const workspace = await getTenantContext();
  if (!workspace) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const capabilityDenied = disabledCapabilityResponse(workspace, "fees_accounting");
  if (capabilityDenied) return capabilityDenied;

  try {
    return NextResponse.json(
      { workspace: await getMinimalFeesWorkspace() },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load fees." },
      { status: 403 }
    );
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  }
  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  }
  const parsed = await readBoundedJson(request, 16_384);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const body = parsed.value as Record<string, unknown>;
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
  }
  const capabilityDenied = disabledCapabilityResponse(workspace, "fees_accounting");
  if (capabilityDenied) return capabilityDenied;

  const admin = createAdminClient();
  const action = asText(body.action);
  let rpc = "";
  let args: Record<string, unknown> = {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId
  };

  if (action === "create_fee") {
    const amount = asNumber(body.amount);
    const name = asText(body.name);
    const frequency = asText(body.frequency);
    if (
      name.length < 2 ||
      amount == null ||
      amount < 0 ||
      !["one_time", "monthly", "term"].includes(frequency)
    ) {
      return NextResponse.json(
        { error: "Valid fee name, amount and frequency are required." },
        { status: 400 }
      );
    }
    rpc = "create_minimal_fee_item_v1";
    args = {
      ...args,
      p_name: name,
      p_amount: amount,
      p_frequency: frequency
    };
  } else if (action === "assign_fee") {
    const feeItemId = asNumber(body.feeItemId);
    const studentPersonId = asNumber(body.studentPersonId);
    const groupId = asNumber(body.groupId);
    const dueDate = asText(body.dueDate);
    const amount = body.amount === "" || body.amount == null ? null : asNumber(body.amount);
    if (!feeItemId || !dueDate || (!!studentPersonId === !!groupId)) {
      return NextResponse.json(
        { error: "Choose a fee and exactly one student or class." },
        { status: 400 }
      );
    }
    rpc = "assign_minimal_fee_v1";
    args = {
      ...args,
      p_fee_item_id: feeItemId,
      p_student_person_id: studentPersonId,
      p_group_id: groupId,
      p_due_date: dueDate,
      p_amount: amount
    };
  } else if (action === "set_concession") {
    const assignmentId = asNumber(body.assignmentId);
    const concession = asNumber(body.concession);
    if (!assignmentId || concession == null || concession < 0) {
      return NextResponse.json(
        { error: "Valid assignment and concession are required." },
        { status: 400 }
      );
    }
    rpc = "set_minimal_fee_concession_v1";
    args = {
      ...args,
      p_assignment_id: assignmentId,
      p_concession: concession
    };
  } else if (action === "record_payment") {
    const assignmentId = asNumber(body.assignmentId);
    const amount = asNumber(body.amount);
    const paymentDate = asText(body.paymentDate);
    const mode = asText(body.mode);
    const note = asText(body.note);
    if (
      !assignmentId ||
      amount == null ||
      amount <= 0 ||
      !paymentDate ||
      !["cash", "bank_transfer", "upi", "cheque", "other"].includes(mode)
    ) {
      return NextResponse.json(
        { error: "Valid payment details are required." },
        { status: 400 }
      );
    }
    rpc = "record_minimal_fee_payment_v1";
    args = {
      ...args,
      p_assignment_id: assignmentId,
      p_amount: amount,
      p_payment_date: paymentDate,
      p_mode: mode,
      p_note: note || null
    };
  } else {
    return NextResponse.json({ error: "Unknown fee action." }, { status: 400 });
  }

  const { data, error } = await admin.rpc(rpc, args);
  if (error) {
    const message = error.message.toLowerCase();
    return NextResponse.json(
      { error: error.message },
      {
        status: message.includes("permission denied")
          ? 403
          : message.includes("not found") || message.includes("exceeds")
            ? 409
            : 422
      }
    );
  }

  return NextResponse.json(
    { result: data },
    {
      status: action === "create_fee" || action === "record_payment" ? 201 : 200,
      headers: { "cache-control": "no-store" }
    }
  );
}

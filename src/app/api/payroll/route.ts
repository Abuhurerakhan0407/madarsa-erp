import { NextResponse } from "next/server";
import { disabledCapabilityResponse } from "@/lib/capabilities/server";
import { getPayrollWorkspace } from "@/lib/payroll/workspace";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

const asNumber = (value: unknown) =>
  Number.isFinite(Number(value)) ? Number(value) : null;
const asText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export async function GET(request: Request) {
  const workspace = await getTenantContext();
  if (!workspace) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const capabilityDenied = disabledCapabilityResponse(workspace, "fees_accounting");
  if (capabilityDenied) return capabilityDenied;

  const month = new URL(request.url).searchParams.get("month") || undefined;
  try {
    return NextResponse.json(
      { workspace: await getPayrollWorkspace(month) },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load payroll." },
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

  if (action === "set_salary") {
    const employmentId = asNumber(body.employmentId);
    const base = asNumber(body.base);
    const allowance = asNumber(body.allowance) ?? 0;
    const deduction = asNumber(body.deduction) ?? 0;
    const effectiveFrom = asText(body.effectiveFrom);
    if (
      !employmentId ||
      base == null ||
      base < 0 ||
      allowance < 0 ||
      deduction < 0 ||
      !effectiveFrom
    ) {
      return NextResponse.json(
        { error: "Valid salary details are required." },
        { status: 400 }
      );
    }
    rpc = "set_minimal_salary_v1";
    args = {
      ...args,
      p_employment_id: employmentId,
      p_base: base,
      p_allowance: allowance,
      p_deduction: deduction,
      p_effective_from: effectiveFrom
    };
  } else if (action === "prepare_run") {
    const monthKey = asText(body.monthKey);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
      return NextResponse.json(
        { error: "Valid payroll month is required." },
        { status: 400 }
      );
    }
    rpc = "prepare_minimal_payroll_v1";
    args = { ...args, p_month_key: monthKey };
  } else if (action === "adjust_line") {
    const lineId = asNumber(body.lineId);
    const allowance = asNumber(body.allowance) ?? 0;
    const deduction = asNumber(body.deduction) ?? 0;
    if (!lineId || allowance < 0 || deduction < 0) {
      return NextResponse.json(
        { error: "Valid payroll adjustment is required." },
        { status: 400 }
      );
    }
    rpc = "adjust_minimal_payroll_line_v1";
    args = {
      ...args,
      p_line_id: lineId,
      p_allowance: allowance,
      p_deduction: deduction,
      p_note: asText(body.note) || null
    };
  } else if (action === "set_state") {
    const runId = asNumber(body.runId);
    const state = asText(body.state);
    if (!runId || !["finalized", "paid"].includes(state)) {
      return NextResponse.json(
        { error: "Valid payroll state transition is required." },
        { status: 400 }
      );
    }
    rpc = "set_minimal_payroll_state_v1";
    args = { ...args, p_run_id: runId, p_state: state };
  } else {
    return NextResponse.json({ error: "Unknown payroll action." }, { status: 400 });
  }

  const { data, error } = await admin.rpc(rpc, args);
  if (error) {
    const message = error.message.toLowerCase();
    return NextResponse.json(
      { error: error.message },
      {
        status: message.includes("permission denied")
          ? 403
          : message.includes("not found") ||
              message.includes("already finalized") ||
              message.includes("state transition")
            ? 409
            : 422
      }
    );
  }

  return NextResponse.json(
    { result: data },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}

import { NextResponse } from "next/server";
import { disabledCapabilityResponse } from "@/lib/capabilities/server";
import { getContributionsWorkspace } from "@/lib/contributions/workspace";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

const asNumber = (value: unknown) =>
  value === null || value === undefined || value === ""
    ? null
    : Number.isFinite(Number(value))
      ? Number(value)
      : null;
const asText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const workspace = await getTenantContext();
  if (!workspace) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const capabilityDenied = disabledCapabilityResponse(
    workspace,
    "donations_zakat_sponsorships"
  );
  if (capabilityDenied) return capabilityDenied;

  try {
    return NextResponse.json(
      { workspace: await getContributionsWorkspace() },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load contributions."
      },
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
  const capabilityDenied = disabledCapabilityResponse(
    workspace,
    "donations_zakat_sponsorships"
  );
  if (capabilityDenied) return capabilityDenied;

  const admin = createAdminClient();
  const action = asText(body.action);
  let rpc = "";
  let args: Record<string, unknown> = {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId
  };

  if (action === "create_contributor") {
    const name = asText(body.name);
    if (name.length < 2) {
      return NextResponse.json(
        { error: "Contributor name is required." },
        { status: 400 }
      );
    }
    rpc = "create_minimal_contributor_v1";
    args = {
      ...args,
      p_name: name,
      p_phone: asText(body.phone) || null,
      p_email: asText(body.email) || null,
      p_note: asText(body.note) || null
    };
  } else if (action === "record_contribution") {
    const contributorId = asNumber(body.contributorId);
    const amount = asNumber(body.amount);
    const type = asText(body.type);
    const date = asText(body.date);
    const method = asText(body.method);
    const studentPersonId = asNumber(body.studentPersonId);
    if (
      !contributorId ||
      !amount ||
      amount <= 0 ||
      !DATE.test(date) ||
      !["donation", "zakat", "sponsorship"].includes(type) ||
      !["cash", "bank_transfer", "upi", "cheque", "other"].includes(method)
    ) {
      return NextResponse.json(
        { error: "Valid contribution details are required." },
        { status: 400 }
      );
    }
    rpc = "record_minimal_contribution_v1";
    args = {
      ...args,
      p_contributor_id: contributorId,
      p_type: type,
      p_amount: amount,
      p_date: date,
      p_method: method,
      p_fund_label: asText(body.fundLabel) || null,
      p_student_person_id: studentPersonId,
      p_note: asText(body.note) || null
    };
  } else {
    return NextResponse.json(
      { error: "Unknown contribution action." },
      { status: 400 }
    );
  }

  const { data, error } = await admin.rpc(rpc, args);
  if (error) {
    const message = error.message.toLowerCase();
    return NextResponse.json(
      { error: error.message },
      {
        status: message.includes("permission denied")
          ? 403
          : message.includes("not found")
            ? 409
            : 422
      }
    );
  }

  return NextResponse.json(
    { result: data },
    { status: 201, headers: { "cache-control": "no-store" } }
  );
}

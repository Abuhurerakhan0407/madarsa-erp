import { notFound, redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getTenantContext, type TenantContext } from "@/lib/tenancy/context";
import { canTenantAccessCapability } from "./access";
import type { ProductCapability } from "./client-profile";

export async function requireTenantCapability(
  capability: ProductCapability
): Promise<TenantContext> {
  const workspace = await getTenantContext();
  if (!workspace) redirect("/onboarding");
  if (!canTenantAccessCapability(workspace.tenantSlug, capability, true, workspace.clientProfile)) {
    notFound();
  }
  return workspace;
}

export function disabledCapabilityResponse(
  workspace: TenantContext,
  capability: ProductCapability
): NextResponse | null {
  if (canTenantAccessCapability(workspace.tenantSlug, capability, true, workspace.clientProfile)) {
    return null;
  }
  return NextResponse.json(
    { error: "Resource not available for this institution." },
    { status: 404, headers: { "cache-control": "no-store" } }
  );
}

import type { ReactNode } from "react";
import { requireTenantCapability } from "@/lib/capabilities/server";
import type { ProductCapability } from "@/lib/capabilities/client-profile";

type CapabilityBoundaryProps = {
  capability: ProductCapability;
  children: ReactNode;
};

export async function CapabilityBoundary({ capability, children }: CapabilityBoundaryProps) {
  await requireTenantCapability(capability);
  return children;
}

import type { ReactNode } from "react";
import { CapabilityBoundary } from "@/components/capability-boundary";

export default function CommercialCapabilityLayout({ children }: { children: ReactNode }) {
  return <CapabilityBoundary capability="payroll">{children}</CapabilityBoundary>;
}

import type { ReactNode } from "react";
import { CapabilityBoundary } from "@/components/capability-boundary";

export default function CommercialCapabilityLayout({ children }: { children: ReactNode }) {
  return <CapabilityBoundary capability="fees_accounting">{children}</CapabilityBoundary>;
}

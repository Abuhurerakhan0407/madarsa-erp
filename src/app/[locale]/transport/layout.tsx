import type { ReactNode } from "react";
import { CapabilityBoundary } from "@/components/capability-boundary";

export default function TransportCapabilityLayout({ children }: { children: ReactNode }) {
  return <CapabilityBoundary capability="transport">{children}</CapabilityBoundary>;
}

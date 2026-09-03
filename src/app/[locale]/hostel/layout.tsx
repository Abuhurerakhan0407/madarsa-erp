import type { ReactNode } from "react";
import { CapabilityBoundary } from "@/components/capability-boundary";

export default function HostelCapabilityLayout({ children }: { children: ReactNode }) {
  return <CapabilityBoundary capability="hostel_mess">{children}</CapabilityBoundary>;
}

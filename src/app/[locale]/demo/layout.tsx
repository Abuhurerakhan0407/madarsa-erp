import type { ReactNode } from "react";
import { CapabilityBoundary } from "@/components/capability-boundary";

export default function DemoSuiteCapabilityLayout({ children }: { children: ReactNode }) {
  return <CapabilityBoundary capability="internal_demo_suite">{children}</CapabilityBoundary>;
}

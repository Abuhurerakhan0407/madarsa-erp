import type { ReactNode } from "react";
import { CapabilityBoundary } from "@/components/capability-boundary";

export default function AccessCapabilityLayout({ children }: { children: ReactNode }) {
  return <CapabilityBoundary capability="branches_roles_ui">{children}</CapabilityBoundary>;
}

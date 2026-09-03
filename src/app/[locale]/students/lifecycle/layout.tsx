import type { ReactNode } from "react";
import { CapabilityBoundary } from "@/components/capability-boundary";

export default function StudentLifecycleCapabilityLayout({ children }: { children: ReactNode }) {
  return <CapabilityBoundary capability="student_lifecycle_import_promotion_renewal">{children}</CapabilityBoundary>;
}

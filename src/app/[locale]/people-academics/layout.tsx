import type { ReactNode } from "react";
import { CapabilityBoundary } from "@/components/capability-boundary";

export default function AcademicsCapabilityLayout({ children }: { children: ReactNode }) {
  return <CapabilityBoundary capability="academics_timetable_homework">{children}</CapabilityBoundary>;
}

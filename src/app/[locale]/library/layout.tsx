import type { ReactNode } from "react";
import { CapabilityBoundary } from "@/components/capability-boundary";

export default function LibraryCapabilityLayout({ children }: { children: ReactNode }) {
  return <CapabilityBoundary capability="library">{children}</CapabilityBoundary>;
}

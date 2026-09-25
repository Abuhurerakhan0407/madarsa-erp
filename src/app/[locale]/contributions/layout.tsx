import type { ReactNode } from "react";
import { CapabilityBoundary } from "@/components/capability-boundary";

export default function ContributionsCapabilityLayout({ children }: { children: ReactNode }) {
  return <CapabilityBoundary capability="donations_zakat_sponsorships">{children}</CapabilityBoundary>;
}

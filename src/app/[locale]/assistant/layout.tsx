import type { ReactNode } from "react";
import { CapabilityBoundary } from "@/components/capability-boundary";

export default function AssistantCapabilityLayout({ children }: { children: ReactNode }) {
  return <CapabilityBoundary capability="ai_assistant">{children}</CapabilityBoundary>;
}

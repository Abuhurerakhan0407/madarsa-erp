import type { ReactNode } from "react";
import { CapabilityBoundary } from "@/components/capability-boundary";

export default function AiCapabilityLayout({ children }: { children: ReactNode }) {
  return <CapabilityBoundary capability="ai_assistant">{children}</CapabilityBoundary>;
}

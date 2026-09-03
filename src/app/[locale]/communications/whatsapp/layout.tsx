import type { ReactNode } from "react";
import { CapabilityBoundary } from "@/components/capability-boundary";

export default function WhatsappCapabilityLayout({ children }: { children: ReactNode }) {
  return <CapabilityBoundary capability="whatsapp_automation">{children}</CapabilityBoundary>;
}

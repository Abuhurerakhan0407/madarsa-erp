import type { ReactNode } from "react";
import { CapabilityBoundary } from "@/components/capability-boundary";
import { requireOfficeSurface } from "@/lib/navigation/office-surface";

export default async function StudentLifecycleCapabilityLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireOfficeSurface(locale, ["academics.enrollment.manage", "academics.structure.read", "students.profile.read"]);
  return <CapabilityBoundary capability="student_lifecycle_import_promotion_renewal">{children}</CapabilityBoundary>;
}

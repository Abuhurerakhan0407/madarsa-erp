import type { ReactNode } from "react";
import { requireOfficeSurface } from "@/lib/navigation/office-surface";

export default async function HostelLayout({
  params,
  children
}: {
  params: Promise<{ locale: string }>;
  children: ReactNode;
}) {
  const { locale } = await params;
  await requireOfficeSurface(locale, ["hostel.resident.manage"], "any");
  return children;
}

import type { Metadata } from "next";
import { appFontVariables } from "@/lib/i18n/fonts";
import "./marketing.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ilmgaah.in"),
  title: {
    default: "Ilmgaah — Institution Operations, Beautifully Unified",
    template: "%s · Ilmgaah"
  },
  description:
    "Ilmgaah brings admissions, student records, biometric attendance, academics, Qur'an and Hifz, exams, staff, documents and family communication into one calm institution operating system.",
  applicationName: "Ilmgaah",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Ilmgaah — Run your institution with less noise.",
    description:
      "A calm operating system for admissions, students, attendance, academics, Qur'an and Hifz, exams, staff, documents and family communication.",
    url: "https://ilmgaah.in",
    siteName: "Ilmgaah",
    type: "website"
  },
  robots: { index: true, follow: true }
};

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${appFontVariables} marketing-body`}>{children}</body>
    </html>
  );
}

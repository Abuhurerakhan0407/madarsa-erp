import type { Metadata } from "next";
import { appFontVariables } from "@/lib/i18n/fonts";
import "../../globals.css";
import "./intake.css";

export const metadata: Metadata = {
  other: {
    google: "notranslate"
  }
};

export default function PublicAdmissionLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" translate="no">
      <body className={appFontVariables}>{children}</body>
    </html>
  );
}

import { appFontVariables } from "@/lib/i18n/fonts";
import "../../globals.css";
import "./intake.css";

export default function PublicAdmissionLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={appFontVariables}>{children}</body>
    </html>
  );
}

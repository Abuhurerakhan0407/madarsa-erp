import { appFontVariables } from "@/lib/i18n/fonts";
import "../globals.css";
import "./tracking.css";

export default function TrackingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={appFontVariables}>{children}</body>
    </html>
  );
}

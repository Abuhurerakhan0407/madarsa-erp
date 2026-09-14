import { appFontVariables } from "@/lib/i18n/fonts";
import "../globals.css";
import "../auth-flow.css";
import "../phase5-polish.css";

export default function OnboardingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={appFontVariables}>{children}</body>
    </html>
  );
}

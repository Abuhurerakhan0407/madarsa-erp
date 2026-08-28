import { appFontVariables } from "@/lib/i18n/fonts";
import "../globals.css";
import "../auth-flow.css";

export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={appFontVariables}>{children}</body>
    </html>
  );
}

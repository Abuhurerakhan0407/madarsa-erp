import { appFontVariables } from "@/lib/i18n/fonts";
import "../globals.css";
import "../auth-professional.css";
import "../professional.css";
import "../phase5-polish.css";

export default function CertificateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={appFontVariables}>
        <div className="auth-screen">
          <main style={{ width: "min(920px,94vw)", margin: "0 auto", padding: "32px 0" }}>{children}</main>
        </div>
      </body>
    </html>
  );
}

import { appFontVariables } from "@/lib/i18n/fonts";
import "../globals.css";
import "../auth-professional.css";
import "../professional.css";
import "../phase5-polish.css";
import "../client-jamia.css";

export default function PortalLayout({children}:Readonly<{children:React.ReactNode}>){
  return <html lang="ur" dir="rtl"><body className={appFontVariables}><div className="auth-screen client-jamia-portal"><main>{children}</main></div></body></html>;
}

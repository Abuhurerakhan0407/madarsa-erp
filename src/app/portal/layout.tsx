import { latinFontVariables } from "@/lib/i18n/fonts";
import "../globals.css";
import "../auth-professional.css";
import "../professional.css";

export default function PortalLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body className={latinFontVariables}><div className="auth-screen"><main style={{width:"min(1100px,94vw)",margin:"0 auto",padding:"32px 0"}}>{children}</main></div></body></html>;}

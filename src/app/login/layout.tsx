import type { Metadata } from "next";
import { latinFontVariables } from "@/lib/i18n/fonts";
import "../globals.css";
import "../auth-flow.css";
import "../auth-professional.css";

export const metadata: Metadata = {
  title: "Sign in — Ilmgaah",
  description: "Secure access to your Ilmgaah institution workspace."
};

export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={latinFontVariables}>{children}</body>
    </html>
  );
}

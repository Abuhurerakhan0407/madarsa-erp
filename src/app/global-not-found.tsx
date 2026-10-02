import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found | Ilmgaah",
  description: "The requested Ilmgaah page does not exist."
};

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", background: "#f4f6f5", color: "#18201c", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
          <section style={{ width: "min(100%, 640px)", padding: "clamp(24px, 6vw, 48px)", border: "1px solid #d8dfd9", borderRadius: "20px", background: "#ffffff", boxShadow: "0 14px 44px rgb(15 35 27 / 8%)" }}>
            <p style={{ margin: "0 0 10px", color: "#0f5132", fontSize: "12px", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>Ilmgaah · 404</p>
            <h1 style={{ margin: 0, fontSize: "clamp(32px, 8vw, 54px)", lineHeight: 1.05, letterSpacing: "-.04em" }}>Page not found</h1>
            <p style={{ margin: "16px 0 0", color: "#607066", fontSize: "16px", lineHeight: 1.65 }}>This address is unavailable or is no longer part of the Ilmgaah release.</p>
            <p dir="rtl" lang="ur" style={{ margin: "10px 0 0", color: "#607066", fontSize: "18px", lineHeight: 1.8 }}>یہ صفحہ دستیاب نہیں ہے یا اب علمگاہ کا حصہ نہیں ہے۔</p>
            <Link href="/" style={{ display: "inline-flex", minHeight: "44px", alignItems: "center", justifyContent: "center", marginTop: "24px", padding: "0 18px", borderRadius: "10px", background: "#176b43", color: "#ffffff", fontWeight: 750, textDecoration: "none" }}>Return to Ilmgaah</Link>
          </section>
        </main>
      </body>
    </html>
  );
}

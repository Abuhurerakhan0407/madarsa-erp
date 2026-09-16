"use client";

export default function GlobalError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f4f7f5", color: "#10231d", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
          <section style={{ width: "min(100%, 560px)", background: "#fff", border: "1px solid #d9e3de", borderRadius: "20px", padding: "32px", boxShadow: "0 18px 50px rgba(16,35,29,.08)" }}>
            <p style={{ margin: "0 0 10px", color: "#176b55", fontSize: "13px", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>Ilmgaah</p>
            <h1 style={{ margin: "0 0 12px", fontSize: "clamp(28px, 6vw, 42px)", lineHeight: 1.08 }}>Application unavailable</h1>
            <p dir="rtl" lang="ur" style={{ margin: "0 0 18px", fontSize: "22px", lineHeight: 1.8, textAlign: "right" }}>ایپ اس وقت دستیاب نہیں ہے</p>
            <p style={{ margin: "0 0 8px", color: "#52645e", lineHeight: 1.6 }}>Something interrupted this page. Your data has not been changed. Try loading the page again.</p>
            <p dir="rtl" lang="ur" style={{ margin: "0 0 24px", color: "#52645e", lineHeight: 1.9, textAlign: "right" }}>اس صفحے کو لوڈ کرنے میں مسئلہ پیش آیا۔ آپ کا ڈیٹا تبدیل نہیں ہوا۔ دوبارہ کوشش کریں۔</p>
            <button
              type="button"
              onClick={reset}
              style={{ minHeight: "46px", border: 0, borderRadius: "12px", padding: "0 20px", background: "#176b55", color: "#fff", font: "inherit", fontWeight: 700, cursor: "pointer" }}
            >
              Retry · دوبارہ کوشش کریں
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}

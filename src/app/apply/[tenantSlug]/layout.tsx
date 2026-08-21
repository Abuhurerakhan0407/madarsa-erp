import "../../globals.css";
import "./intake.css";

export default function PublicAdmissionLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

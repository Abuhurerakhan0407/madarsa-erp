import { verifyStudentStatusCertificate } from "@/lib/documents/student-status";

export default async function CertificateVerificationPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const query = await searchParams;
  const code = typeof query.code === "string" ? query.code.trim().toUpperCase() : "";
  const certificate = code ? await verifyStudentStatusCertificate(code) : null;

  return <main className="auth-page">
    <section className="auth-card">
      <p className="eyebrow">Document verification</p>
      <h1>Student Status Certificate</h1>
      <form method="get" className="field-stack">
        <label className="field-label">Verification code<input className="text-field" name="code" defaultValue={code} placeholder="SSC-XXXXXXXXXXXXXXXX" autoComplete="off" /></label>
        <button className="action-button" type="submit">Verify certificate</button>
      </form>
      {code ? certificate ? <section className="panel">
        <p className="state-kicker">Verified active document</p>
        <h2>{certificate.snapshot.studentName}</h2>
        <div className="detail-grid"><div><span>Student ID</span><strong>{certificate.snapshot.studentNumber}</strong></div><div><span>Institution</span><strong>{certificate.snapshot.tenantName}</strong></div><div><span>Campus</span><strong>{certificate.snapshot.branchName}</strong></div><div><span>Program</span><strong>{certificate.snapshot.program}</strong></div><div><span>Class / group</span><strong>{certificate.snapshot.classGroup}</strong></div><div><span>Issued on</span><strong>{certificate.snapshot.issuedOn}</strong></div><div><span>Revision</span><strong>{certificate.revision}</strong></div><div><span>Verification code</span><strong className="verification-code">{certificate.verificationCode}</strong></div></div>
      </section> : <p className="form-message form-error" role="alert">No active public certificate matches this verification code.</p> : <p>Enter the verification code printed on the certificate.</p>}
    </section>
  </main>;
}

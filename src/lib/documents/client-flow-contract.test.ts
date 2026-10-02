import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("client IDs & Documents flow", () => {
  it("uses one compact document-type selector instead of type cards", () => {
    const page = read("src/app/[locale]/documents/page.tsx");
    expect(page).toContain("<DocumentTypeSelect");
    expect(page).not.toContain('className="reports-picker"');
    expect(page).not.toContain('className={`report-card');
  });

  it("cancels stale generation work and prevents rapid duplicate jobs", () => {
    const source = read("src/components/document-center-v2.tsx");
    expect(source).toContain("const requestVersion = useRef(0)");
    expect(source).toContain("const actionLock = useRef(false)");
    expect(source).toContain("new AbortController()");
    expect(source).toContain("REQUEST_TIMEOUT_MS");
    expect(source).toContain("requestId !== requestVersion.current");
  });

  it("recovers from generation timeout and supports explicit retry", () => {
    const source = read("src/components/document-center-v2.tsx");
    expect(source).toContain("t.generateTimeout");
    expect(source).toContain("setLastRequest(request)");
    expect(source).toContain("lastRequest.requestKey");
    expect(source).toContain("requestKey = crypto.randomUUID()");
    expect(source).toContain("t.retry");
  });

  it("delays Blob URL cleanup for Android/TWA download handoff", () => {
    const source = read("src/components/document-center-v2.tsx");
    expect(source).toContain("anchor.click()");
    expect(source).toContain("window.setTimeout(() => URL.revokeObjectURL(url), 1500)");
    expect(source).not.toContain("anchor.remove();URL.revokeObjectURL(url)");
  });

  it("uses server-provided institution-aware PDF filenames", () => {
    const client = read("src/components/document-center-v2.tsx");
    const route = read("src/app/api/documents/pdf/route.ts");
    expect(client).toContain("responseFilename(response, fallback)");
    expect(route).toContain("safeFilenamePart(workspace.tenantName)");
    expect(route).toContain("Valid request key is required for certificate generation.");
    expect(route).toContain("issueStudentStatusCertificate(personId,");
    expect(route).toContain("'content-disposition'");
  });
});

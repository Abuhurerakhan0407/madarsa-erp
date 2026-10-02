import { NextResponse } from "next/server";
import { operatorHasPermissions } from "@/lib/access/operator-permission";
import { getStudentDocumentStatus } from "@/lib/documents/student-files";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ personId: string; documentId: string }> }
) {
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
  }
  if (!(await operatorHasPermissions(workspace, ["documents.file.read"]))) {
    return NextResponse.json({ error: "Document read permission required." }, { status: 403 });
  }

  const raw = await params;
  const personId = Number(raw.personId);
  const documentId = Number(raw.documentId);
  if (!Number.isSafeInteger(personId) || personId <= 0 || !Number.isSafeInteger(documentId) || documentId <= 0) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const status = await getStudentDocumentStatus(personId, "en");
  if (!status || !status.documents.some((document) => document.id === documentId)) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: version, error } = await admin
    .from("document_versions")
    .select("storage_path")
    .eq("tenant_id", workspace.tenantId)
    .eq("document_id", documentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load document." }, { status: 500 });
  if (!version?.storage_path || typeof version.storage_path !== "string") {
    return NextResponse.json({ error: "Document file not available." }, { status: 404 });
  }
  if (!version.storage_path.startsWith(`${workspace.tenantId}/`)) {
    return NextResponse.json({ error: "Document file path is invalid." }, { status: 500 });
  }

  const signed = await admin.storage.from("tenant-documents").createSignedUrl(version.storage_path, 60);
  if (signed.error || !signed.data.signedUrl) {
    return NextResponse.json({ error: "Unable to open document." }, { status: 500 });
  }
  return NextResponse.redirect(signed.data.signedUrl, { status: 307 });
}
